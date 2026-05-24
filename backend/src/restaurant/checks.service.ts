import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { subject } from '@casl/ability';
import { RestaurantCheck } from './entities/restaurant-check.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from './entities/menu-item.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { EventsService } from '../events/events.service';
import { ShiftsService } from '../shifts/shifts.service';
import { FoliosService } from '../folios/folios.service';
import { OutletsService } from '../outlets/outlets.service';
import { AppAbility } from '../casl/casl-ability.factory';
import { assertCanAct } from '../casl/ownership';

interface IncomingRoundItem {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes?: string;
}

/**
 * Owns the table-check lifecycle: open a check for a table, append rounds
 * (each round = one "send" / KOT), keep the consolidated total in sync, and
 * cancel. Settlement lives in SettlementService (separate concern).
 *
 * Routing rule applied per item when a round is added:
 *   station 'kitchen' | 'bar' → status 'sent'   (appears on that KDS)
 *   station 'none'            → status 'served' (waiter brings it; never on KDS)
 */
@Injectable()
export class ChecksService {
  constructor(
    @InjectRepository(RestaurantCheck)
    private readonly checkRepo: Repository<RestaurantCheck>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    @InjectRepository(Transaction)
    private readonly transRepo: Repository<Transaction>,
    private readonly eventsService: EventsService,
    private readonly shiftsService: ShiftsService,
    private readonly foliosService: FoliosService,
    private readonly outletsService: OutletsService,
  ) {}

  async findOpenChecks(
    scope: Record<string, any> = {},
  ): Promise<RestaurantCheck[]> {
    return this.checkRepo.find({
      where: { status: 'open', ...scope },
      relations: ['orders', 'orders.items'],
      order: { openedAt: 'DESC' },
    });
  }

  async getCheck(id: string): Promise<RestaurantCheck> {
    const check = await this.checkRepo.findOne({
      where: { id },
      relations: ['orders', 'orders.items'],
    });
    if (!check) throw new NotFoundException('Check not found');
    return check;
  }

  /**
   * Open a check for a table. Idempotent per table: if an open check already
   * exists for the table number, it's returned instead of creating a second
   * one — this is what makes a guest's later orders land on the same bill.
   */
  async openCheck(
    data: {
      tableNumber: string;
      openedBy?: string;
      openedByName?: string;
      guestId?: string;
      guestCount?: number;
    },
    ability?: AppAbility,
  ): Promise<RestaurantCheck> {
    const tableNumber = (data.tableNumber || '').trim();
    if (!tableNumber) {
      throw new BadRequestException('tableNumber is required');
    }

    const existing = await this.checkRepo.findOne({
      where: { tableNumber, status: 'open' },
    });
    if (existing) {
      // A table is claimed by whoever opened it. If the caller can't access the
      // existing check (a different waiter), surface a clear conflict rather
      // than handing back — or silently creating a duplicate on — a table that
      // isn't theirs. Owner / admin / manager pass the can('read') check.
      if (ability && !ability.can('read', subject('Check', existing as any))) {
        throw new ConflictException(
          `Стол ${tableNumber} уже обслуживает другой официант`,
        );
      }
      return this.getCheck(existing.id);
    }

    const check = this.checkRepo.create({
      tableNumber,
      status: 'open',
      openedBy: data.openedBy,
      openedByName: data.openedByName,
      guestId: data.guestId || undefined,
      guestCount: data.guestCount ?? 1,
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      paidAmount: 0,
    });
    const saved = await this.checkRepo.save(check);
    this.eventsService.emitCheckOpened(saved);
    return saved;
  }

  /**
   * Append a round (a single "send") to an open check. Resolves each line's
   * station from its menu item, routes accordingly, recomputes the check
   * total, and notifies the relevant KDS station(s).
   */
  async addRound(
    checkId: string,
    data: {
      items: IncomingRoundItem[];
      waiterId?: string;
      waiterName?: string;
    },
    ability?: AppAbility,
  ): Promise<Order> {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('Round must have at least one item');
    }

    const check = await this.getCheck(checkId);
    if (ability) assertCanAct(ability, 'update', 'Check', check);
    if (check.status !== 'open') {
      throw new BadRequestException(
        `Cannot add a round to a ${check.status} check`,
      );
    }

    const menuIds = [...new Set(data.items.map((i) => i.menuItemId))];
    const menuItems = menuIds.length
      ? await this.menuRepo.findBy({ id: In(menuIds) })
      : [];
    const stationById = new Map(
      menuItems.map((m) => [m.id, m.station || 'kitchen']),
    );

    const roundNumber =
      (await this.orderRepo.count({ where: { checkId } })) + 1;

    const roundTotal = data.items.reduce(
      (sum, it) => sum + Number(it.menuItemPrice) * it.quantity,
      0,
    );

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        checkId,
        roundNumber,
        tableNumber: check.tableNumber,
        waiterId: data.waiterId,
        waiterName: data.waiterName,
        status: 'pending',
        total: roundTotal,
      }),
    );

    const now = new Date();
    const rows = data.items.map((it) => {
      const station = stationById.get(it.menuItemId) || 'kitchen';
      const isNone = station === 'none';
      return this.itemRepo.create({
        orderId: order.id,
        menuItemId: it.menuItemId,
        menuItemName: it.menuItemName,
        menuItemPrice: it.menuItemPrice,
        quantity: it.quantity,
        notes: it.notes,
        station,
        status: isNone ? 'served' : 'sent',
        firedAt: isNone ? undefined : now,
        servedAt: isNone ? now : undefined,
      });
    });
    await this.itemRepo.save(rows);

    await this.recalcTotals(checkId);

    const full = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items'],
    });

    // Legacy compat for any listener still on the old order stream.
    this.eventsService.emitOrderCreated(full);
    // Wake up only the stations that actually got prep items.
    const stations = new Set(
      rows.filter((r) => r.station !== 'none').map((r) => r.station),
    );
    for (const station of stations) {
      this.eventsService.emitKdsUpdated(station);
    }
    this.eventsService.emitCheckUpdated(await this.getCheck(checkId));

    return full!;
  }

  /** Recompute subtotal/total from non-cancelled line items across all rounds. */
  async recalcTotals(checkId: string): Promise<void> {
    const orders = await this.orderRepo.find({
      where: { checkId },
      relations: ['items'],
    });
    let subtotal = 0;
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item.status === 'cancelled') continue;
        subtotal += Number(item.menuItemPrice) * item.quantity;
      }
    }
    const check = await this.checkRepo.findOne({ where: { id: checkId } });
    const discountTotal = Number(check?.discountTotal) || 0;
    await this.checkRepo.update(checkId, {
      subtotal,
      total: Math.max(0, subtotal - discountTotal),
    });
  }

  // ─── KDS (kitchen / bar display) ───────────────────────────────────

  /**
   * Active queue for a prep station: all order items routed to `station` that
   * are still in play (sent / preparing / ready), grouped into tickets by
   * round so each KDS card maps to one "send". 'none' items never appear here.
   */
  async findStationQueue(station: string) {
    const items = await this.itemRepo.find({
      where: { station, status: In(['sent', 'preparing', 'ready']) },
      relations: ['order'],
    });

    const byOrder = new Map<string, any>();
    for (const it of items) {
      const order = it.order;
      if (!order) continue;
      if (!byOrder.has(order.id)) {
        byOrder.set(order.id, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          roundNumber: order.roundNumber,
          tableNumber: order.tableNumber,
          checkId: order.checkId,
          createdAt: order.createdAt,
          items: [],
        });
      }
      byOrder.get(order.id).items.push({
        id: it.id,
        menuItemName: it.menuItemName,
        quantity: it.quantity,
        notes: it.notes,
        status: it.status,
        firedAt: it.firedAt,
      });
    }

    return [...byOrder.values()].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  /**
   * Advance a single line item's status (KDS bump or waiter "served"). Stamps
   * the matching timestamp, re-derives the parent round's aggregate status, and
   * notifies the station KDS + the parent check.
   */
  async updateItemStatus(
    itemId: string,
    status: string,
    _actor?: { userId: string; userName?: string },
    ability?: AppAbility,
  ): Promise<OrderItem> {
    const ALLOWED = ['sent', 'preparing', 'ready', 'served'];
    if (!ALLOWED.includes(status)) {
      throw new BadRequestException(`Invalid item status: ${status}`);
    }
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Order item not found');
    // Cook/barman (unconditional update Order) can bump any ticket; a waiter
    // (conditioned on waiterId) can only touch items on their own rounds.
    if (ability && item.order) {
      assertCanAct(ability, 'update', 'Order', item.order);
    }

    const now = new Date();
    item.status = status;
    if (status === 'preparing' && !item.firedAt) item.firedAt = now;
    if (status === 'ready') item.readyAt = now;
    if (status === 'served') item.servedAt = now;
    await this.itemRepo.save(item);

    await this.recomputeOrderStatus(item.orderId);
    this.eventsService.emitKdsUpdated(item.station);
    if (item.order?.checkId) {
      this.eventsService.emitCheckUpdated(await this.getCheck(item.order.checkId));
    }
    return item;
  }

  /**
   * Re-derive the legacy whole-order status from its items so the existing
   * order list / analytics "active orders" keep working alongside per-item KDS.
   */
  private async recomputeOrderStatus(orderId: string): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) return;
    const active = (order.items || []).filter((i) => i.status !== 'cancelled');
    if (active.length === 0) return;

    let status: string;
    if (active.every((i) => i.status === 'served')) status = 'completed';
    else if (active.every((i) => i.status === 'ready' || i.status === 'served'))
      status = 'ready';
    else if (
      active.some((i) => ['preparing', 'ready', 'served'].includes(i.status))
    )
      status = 'preparing';
    else status = 'pending';

    if (status !== order.status) {
      order.status = status;
      await this.orderRepo.save(order);
      this.eventsService.emitOrderStatusChanged(order.id, status);
    }
  }

  // ─── Settlement ────────────────────────────────────────────────────

  /**
   * Settle (pay) a check and close it.
   *   cash / card → requires the settling user's open shift; records a POS
   *                 Transaction (type 'restaurant') so the sale flows into
   *                 revenue, top-items and the till variance like any sale.
   *   folio       → posts a 'restaurant' charge onto the guest's folio and
   *                 records a folio-method Transaction (revenue, not cash).
   * Any still-active items are marked served (the visit has ended).
   */
  async settle(
    checkId: string,
    data: {
      method: 'cash' | 'card' | 'folio';
      folioId?: string;
      employeeId: string;
      employeeName?: string;
      outletId?: string;
    },
    ability?: AppAbility,
  ): Promise<RestaurantCheck> {
    const check = await this.getCheck(checkId);
    if (ability) assertCanAct(ability, 'update', 'Check', check);
    if (check.status !== 'open') {
      throw new BadRequestException('Check is not open');
    }
    const billableItems = (check.orders || [])
      .flatMap((o) => o.items || [])
      .filter((i) => i.status !== 'cancelled');
    if (billableItems.length === 0) {
      throw new BadRequestException('Cannot settle an empty check');
    }
    if (data.method === 'folio' && !data.folioId) {
      throw new BadRequestException('folioId is required for folio payment');
    }

    const total = Number(check.total) || 0;

    const outlets = await this.outletsService.findAll();
    const outlet =
      (data.outletId
        ? outlets.find((o) => o.id === data.outletId)
        : outlets.find((o) => o.type === 'restaurant')) || null;

    let shiftId: string | undefined;
    if (data.method !== 'folio') {
      const shift = await this.shiftsService.requireActiveShift(
        data.employeeId,
        outlet?.id,
      );
      shiftId = shift.id;
    }

    const savedTx = await this.transRepo.save(
      this.transRepo.create({
        type: 'restaurant',
        employeeId: data.employeeId,
        employee: data.employeeName,
        total,
        tableNumber: (check.tableNumber || '').slice(0, 10),
        paymentMethod: data.method,
        outletId: outlet?.id,
        folioId: data.method === 'folio' ? data.folioId : undefined,
        shiftId,
        status: 'completed',
        items: billableItems.map((i) => ({
          name: i.menuItemName,
          price: Number(i.menuItemPrice),
          quantity: i.quantity,
        })),
      }),
    );

    if (data.method === 'folio' && data.folioId) {
      await this.foliosService.addCharge(data.folioId, {
        chargeType: 'restaurant',
        description: `Ресторан: счёт #${check.checkNumber}`,
        amount: total,
        sourceId: check.id,
        addedBy: data.employeeId,
      });
    }

    // Mark any still-active items served — the visit is over.
    const now = new Date();
    for (const item of billableItems) {
      if (item.status !== 'served') {
        await this.itemRepo.update(item.id, { status: 'served', servedAt: now });
      }
    }

    await this.checkRepo.update(checkId, {
      status: 'closed',
      paymentMethod: data.method,
      paidAmount: total,
      settledBy: data.employeeId,
      settledAt: now,
      folioId: data.method === 'folio' ? data.folioId : check.folioId,
      closedAt: now,
    });

    this.eventsService.emitTransactionCreated(savedTx);
    this.eventsService.emitCheckClosed(checkId);
    this.eventsService.emitKdsUpdated('kitchen');
    this.eventsService.emitKdsUpdated('bar');

    return this.getCheck(checkId);
  }

  async cancelCheck(
    checkId: string,
    reason?: string,
    ability?: AppAbility,
  ): Promise<RestaurantCheck> {
    const check = await this.getCheck(checkId);
    if (ability) assertCanAct(ability, 'delete', 'Check', check);
    if (check.status === 'closed') {
      throw new BadRequestException('Cannot cancel a settled check');
    }
    check.status = 'cancelled';
    check.closedAt = new Date();
    if (reason) check.notes = reason;
    const saved = await this.checkRepo.save(check);
    this.eventsService.emitCheckClosed(checkId);
    return saved;
  }
}
