import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  emitOrderCreated(order: any) {
    this.gateway.server?.emit('order:created', order);
  }

  emitOrderStatusChanged(orderId: string, status: string) {
    this.gateway.server?.emit('order:statusChanged', { orderId, status });
  }

  emitRoomStatusChanged(
    roomNumber: number,
    status: string,
    cleaningStatus: string,
  ) {
    this.gateway.server?.emit('room:statusChanged', {
      roomNumber,
      status,
      cleaningStatus,
    });
  }

  emitTransactionCreated(transaction: any) {
    this.gateway.server?.emit('transaction:created', transaction);
  }

  emitInventoryLowStock(item: any) {
    this.gateway.server?.emit('inventory:lowStock', item);
  }

  emitCleaningTaskCreated(task: any) {
    this.gateway.server?.emit('cleaningTask:created', task);
  }

  emitCleaningTaskAssigned(task: any) {
    this.gateway.server?.emit('cleaningTask:assigned', task);
  }

  emitCleaningTaskStatusChanged(task: any) {
    this.gateway.server?.emit('cleaningTask:statusChanged', {
      id: task.id,
      status: task.status,
      roomNumber: task.roomNumber,
      assignedTo: task.assignedTo,
    });
  }

  /**
   * Broadcast a "risky action" — refund, discount, large variance, etc. The
   * staff app surfaces these in a banner for admin/owner roles. Frontend
   * filtering by role keeps this simple; everyone receives but only the
   * owner UI shows it.
   */
  emitRiskyAction(payload: {
    type:
      | 'refund'
      | 'discount'
      | 'shift-variance'
      | 'order-edit'
      | 'cleaning-skip'
      | 'reservation-cancel';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    detail?: string;
    actorId?: string;
    actorName?: string;
    amount?: number;
    subjectId?: string;
    subject?: string;
    createdAt?: Date;
  }) {
    this.gateway.server?.emit('risky:action', {
      ...payload,
      createdAt: payload.createdAt || new Date(),
    });
    // For warning/critical, also push to admin/owner devices so they get a
    // notification even if the staff app is in the background.
    if (payload.severity !== 'info') {
      this.notifications
        .sendToRole(
          ['admin', 'owner', 'manager'],
          payload.title,
          payload.detail || '',
        )
        .catch(() => undefined);
    }
  }
}
