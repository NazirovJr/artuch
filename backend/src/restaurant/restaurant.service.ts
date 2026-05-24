import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderEditLog } from './entities/order-edit-log.entity';
import { EventsService } from '../events/events.service';
//
// We treat any item-level edit on a protected order as a risky action so the
// owner sees it surfaced in real time. Pre-cooking edits are silent.

// Once an order has reached the kitchen, line items can no longer be freely
// rewritten — the kitchen has acted on them, the guest expects them, and the
// money has already moved. Edits past this point require manager approval.
// Status values must match update-order-status.dto.ts (pending, preparing,
// ready, completed, cancelled). An order is also protected once it has been
// paid or charged to a folio, regardless of status.
const PROTECTED_ORDER_STATUSES = ['preparing', 'ready', 'completed'];
const PROTECTED_PAYMENT_STATUSES = ['paid', 'charged-to-folio'];

interface IncomingOrderItem {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes?: string;
}

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(MenuItem)
    private menuRepo: Repository<MenuItem>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderEditLog)
    private orderEditLogsRepo: Repository<OrderEditLog>,
    private eventsService: EventsService,
  ) {}

  async findAllMenuItems(): Promise<MenuItem[]> {
    return this.menuRepo.find({ where: { isActive: true }, order: { category: 'ASC', name: 'ASC' } });
  }

  /** Admin view: includes inactive items so they can be re-enabled / edited. */
  async findAllMenuItemsAdmin(): Promise<MenuItem[]> {
    return this.menuRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async createMenuItem(data: Partial<MenuItem>): Promise<MenuItem> {
    return this.menuRepo.save(this.menuRepo.create(data));
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    const item = await this.menuRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    Object.assign(item, data);
    return this.menuRepo.save(item);
  }

  async findAllOrders(
    status?: string,
    scope: Record<string, any> = {},
  ): Promise<Order[]> {
    const where: any = { ...scope };
    if (status) where.status = status;
    return this.ordersRepo.find({ where, order: { createdAt: 'DESC' }, relations: ['items'] });
  }

  async findOrderById(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  isProtectedStatus(status: string, paymentStatus?: string): boolean {
    return (
      PROTECTED_ORDER_STATUSES.includes(status) ||
      (!!paymentStatus && PROTECTED_PAYMENT_STATUSES.includes(paymentStatus))
    );
  }

  async createOrder(data: any): Promise<Order> {
    const order = this.ordersRepo.create(data);
    const saved = await ((this.ordersRepo.save(order) as any) as Promise<Order>);
    this.eventsService.emitOrderCreated(saved);
    return saved;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    order.status = status;
    const saved = await this.ordersRepo.save(order);
    this.eventsService.emitOrderStatusChanged(id, status);
    return saved;
  }

  /**
   * Replace the line items of an order. Any edit done after the order has
   * left the waiter's hands (cooking/ready/served/paid) requires a manager
   * PIN — the controller is responsible for validating it and passing the
   * resulting `approval`. Every edit produces an immutable OrderEditLog
   * snapshot so accounting and audit can reconstruct the before/after.
   */
  async updateOrderItems(
    id: string,
    items: IncomingOrderItem[],
    actor: { userId: string; userName?: string },
    options: {
      reason?: string;
      approval?: { userId: string; reason: string; approvedAt: Date };
    } = {},
  ): Promise<Order> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    const order = await this.findOrderById(id);

    if (
      this.isProtectedStatus(order.status, order.paymentStatus) &&
      !options.approval
    ) {
      throw new ForbiddenException(
        `Order in status "${order.status}" / payment "${order.paymentStatus}" can be edited only with manager approval`,
      );
    }

    const oldItems = order.items.map((it) => ({
      menuItemId: it.menuItemId,
      menuItemName: it.menuItemName,
      menuItemPrice: Number(it.menuItemPrice),
      quantity: it.quantity,
      notes: it.notes,
    }));
    const oldTotal = Number(order.total);

    // Replace items. Cascade in Order.items handles persistence on save below,
    // but we wipe the existing rows explicitly to avoid orphans when an item
    // is removed entirely.
    await this.orderItemsRepo.delete({ orderId: id });
    const newRows = items.map((it) =>
      this.orderItemsRepo.create({
        orderId: id,
        menuItemId: it.menuItemId,
        menuItemName: it.menuItemName,
        menuItemPrice: it.menuItemPrice,
        quantity: it.quantity,
        notes: it.notes,
      }),
    );
    await this.orderItemsRepo.save(newRows);

    const newTotal = newRows.reduce(
      (sum, it) => sum + Number(it.menuItemPrice) * it.quantity,
      0,
    );
    order.total = newTotal;
    const saved = await this.ordersRepo.save(order);

    await this.orderEditLogsRepo.save(
      this.orderEditLogsRepo.create({
        orderId: id,
        orderStatusAtEdit: order.status,
        oldItems,
        newItems: items,
        oldTotal,
        newTotal,
        changedBy: actor.userId,
        changedByName: actor.userName,
        reason: options.reason,
        approvedBy: options.approval?.userId,
        approvalReason: options.approval?.reason,
      }),
    );

    if (options.approval) {
      this.eventsService.emitRiskyAction({
        type: 'order-edit',
        severity: 'warning',
        title: `Изменение заказа #${order.orderNumber}`,
        detail: `Сумма ${oldTotal.toFixed(2)} → ${newTotal.toFixed(2)} TJS`,
        actorId: actor.userId,
        actorName: actor.userName,
        amount: Math.abs(newTotal - oldTotal),
        subjectId: id,
        subject: 'Order',
      });
    }

    return this.findOrderById(saved.id);
  }

  async findOrderEditLogs(orderId: string): Promise<OrderEditLog[]> {
    return this.orderEditLogsRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
