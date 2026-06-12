import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { deterministicUuid } from '../common/deterministic-uuid';
import { Transaction } from './entities/transaction.entity';
import { Refund } from './entities/refund.entity';
import { InventoryService } from '../inventory/inventory.service';
import { EventsService } from '../events/events.service';
import { ShiftsService } from '../shifts/shifts.service';
import { FoliosService } from '../folios/folios.service';
import { OutletsService } from '../outlets/outlets.service';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(Transaction)
    private transRepo: Repository<Transaction>,
    @InjectRepository(Refund)
    private refundRepo: Repository<Refund>,
    private inventoryService: InventoryService,
    private eventsService: EventsService,
    private shiftsService: ShiftsService,
    private foliosService: FoliosService,
    private outletsService: OutletsService,
  ) {}

  async findAll(type?: string): Promise<Transaction[]> {
    const where: any = {};
    if (type) where.type = type;
    return this.transRepo.find({ where, order: { createdAt: 'DESC' }, relations: ['items'] });
  }

  async create(data: any): Promise<Transaction> {
    if (!data.employeeId) {
      throw new NotFoundException('employeeId is required');
    }

    // Guard the money-shaped fields before they hit the DB. Previously the
    // raw `any` body was saved blind, so a malformed payload could persist a
    // NaN/negative total or an empty sale. (Lightweight inline checks instead
    // of a strict DTO, which — with whitelist stripping — risked silently
    // dropping fields like items[].volume.)
    const total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) {
      throw new BadRequestException('total must be a non-negative number');
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    for (const line of data.items) {
      const price = Number(line?.price);
      const qty = Number(line?.quantity);
      if (!line?.name || !Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException(
          'each item needs a name, a numeric price and a positive quantity',
        );
      }
    }

    // Two paths depending on payment method:
    //   cash / card / mobile → cashier's active shift is required (money
    //     moves through the till, variance must account for it).
    //   folio → no active shift required. It's not a cash event; the bill
    //     is parked on the guest's folio and settled at checkout. We still
    //     create a Transaction (for inventory, audit, receipt print), but
    //     computeExpectedCash() filters by paymentMethod='cash' so this
    //     one won't affect the variance.
    const isFolio = data.paymentMethod === 'folio';
    if (isFolio && !data.folioId) {
      throw new BadRequestException(
        'folioId is required when paymentMethod is "folio"',
      );
    }

    let shiftId: string | undefined;
    if (!isFolio) {
      const shift = await this.shiftsService.requireActiveShift(
        data.employeeId,
        data.outletId,
      );
      shiftId = shift.id;
    }

    // Resolve each line's inventory itemId (prefer client-supplied, else by
    // name) so the persisted line AND the stock deduction both bind to a
    // stable id rather than a mutable name. Unresolved lines (services /
    // ad-hoc) keep itemId undefined and fall back to name downstream.
    for (const line of data.items || []) {
      if (!line.itemId && line.name) {
        const inv = await this.inventoryService.findItemByName(line.name);
        if (inv) line.itemId = inv.id;
      }
    }

    // Cast the spread to a single Partial<Transaction> so TypeORM's `create`
    // resolves to the single-entity overload (a raw `any` arg makes it infer
    // Transaction[]). This replaces the old `save(...) as any`.
    const transaction = this.transRepo.create({
      ...data,
      ...(shiftId ? { shiftId } : {}),
    } as Partial<Transaction>);
    const saved = await this.transRepo.save(transaction);

    // Decrement stock for each sold item — folio-billed goods still leave
    // the shelf, so this runs regardless of payment method.
    for (const item of data.items || []) {
      await this.inventoryService.decrementStock(
        item.name,
        item.quantity,
        item.itemId,
      );
    }

    // Post onto the guest's folio if this was a room-bill sale. chargeType
    // mirrors the outlet type so the bill prints "Ресторан / Бар / Магазин /
    // Прокат" instead of a generic "misc".
    if (isFolio) {
      // findById throws on missing outlet; we tolerate that (edge case of a
      // deleted outlet mid-session) and fall back to a generic chargeType.
      let outlet: { type?: string; name?: string } | null = null;
      if (data.outletId) {
        try {
          outlet = await this.outletsService.findById(data.outletId);
        } catch {
          outlet = null;
        }
      }
      const chargeType = (outlet?.type as string) || 'service';
      const outletName = outlet?.name || 'POS';
      const count = (data.items || []).length;
      const description =
        count > 0
          ? `${outletName}: ${count} ${count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций'}`
          : `${outletName}: покупка`;
      await this.foliosService.addCharge(data.folioId, {
        chargeType,
        description,
        amount: Number(data.total) || 0,
        sourceId: saved.id,
        addedBy: data.employeeId,
      });
    }

    this.eventsService.emitTransactionCreated(saved);
    return saved;
  }

  async createRefund(data: {
    transactionId: string;
    items: Array<{ name: string; price: number; quantity: number }>;
    amount: number;
    reason: string;
    employeeId: string;
    employeeName: string;
    folioId?: string;
    idempotencyKey?: string;
    approval?: { userId: string; reason: string; approvedAt: Date };
  }): Promise<Refund> {
    // Idempotency: a retried/double-tapped refund reuses the same key, so we
    // return the already-created refund instead of issuing a second one
    // (which would double the money out, flip status twice, re-emit alerts).
    if (data.idempotencyKey) {
      const existing = await this.refundRepo.findOne({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) return existing;
    }

    const transaction = await this.transRepo.findOne({
      where: { id: data.transactionId },
      relations: ['items'],
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const shift = await this.shiftsService.requireActiveShift(
      data.employeeId,
      transaction.outletId,
    );

    const refund = this.refundRepo.create({
      ...data,
      shiftId: shift.id,
      approvedBy: data.approval?.userId,
      approvedAt: data.approval?.approvedAt ?? null,
      approvalReason: data.approval?.reason,
    });
    const saved = await this.refundRepo.save(refund);

    // Determine if full or partial refund
    const transactionTotal = Number(transaction.total);
    const refundAmount = Number(data.amount);
    transaction.status =
      refundAmount >= transactionTotal ? 'refunded' : 'partially-refunded';
    await this.transRepo.save(transaction);

    // Put the refunded goods back on the shelf. Mirror of the sale-time
    // decrement; idempotency key is per (refund, line) so a retried refund
    // won't double-restock. Bind by the stored itemId from the original
    // transaction line (stable key), falling back to name. Services /
    // non-stock lines resolve to no item and are skipped inside restockStock.
    const itemIdByName = new Map(
      (transaction.items || []).map((it) => [it.name, it.itemId]),
    );
    const refundItems = data.items || [];
    for (let i = 0; i < refundItems.length; i++) {
      const line = refundItems[i];
      // stock_movements.idempotencyKey is a uuid column, so derive a stable
      // uuid from the refund id + line index rather than a free string — a
      // retried refund reuses the same key and won't double-restock.
      const idemKey = deterministicUuid(`refund-restock:${saved.id}:${i}`);
      await this.inventoryService.restockStock(
        line.name,
        line.quantity,
        idemKey,
        itemIdByName.get(line.name),
      );
    }

    // Surface every refund to the owner feed. Severity scales with size:
    // anything above 25% of the original transaction is "warning", a full
    // refund is "critical" — easier to spot patterns from owner UI.
    const ratio = transactionTotal > 0 ? refundAmount / transactionTotal : 1;
    const severity =
      ratio >= 1 ? 'critical' : ratio >= 0.25 ? 'warning' : 'info';
    this.eventsService.emitRiskyAction({
      type: 'refund',
      severity,
      title: `Возврат ${refundAmount.toFixed(2)} TJS`,
      detail: data.reason,
      actorId: data.employeeId,
      actorName: data.employeeName,
      amount: refundAmount,
      subjectId: saved.id,
      subject: 'Refund',
    });

    return saved;
  }

  async findAllRefunds(): Promise<Refund[]> {
    return this.refundRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['transaction'],
    });
  }
}
