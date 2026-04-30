import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import {
  AlertSeverity,
  AlertSource,
  LowStockAlert,
} from './entities/low-stock-alert.entity';

export interface AlertCheckPayload {
  source: AlertSource;
  itemId: string;
  itemName: string;
  warehouseId?: string;
  currentLevel: number;
  reorderPoint: number;
  parLevel?: number;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(LowStockAlert)
    private alertsRepo: Repository<LowStockAlert>,
  ) {}

  /**
   * Re-evaluate the threshold for an item and either open a new alert,
   * update an existing open alert's currentLevel, or auto-resolve (delete?
   * No — auto-acknowledge with a marker) when stock comes back above PAR.
   *
   * Idempotent and cheap: at most 1 SELECT + 1 INSERT/UPDATE per call.
   * Designed to be invoked from inside the same DB transaction as the
   * stock-mutating service so the alert lands or rolls back together.
   */
  async checkAndUpsert(
    mgr: EntityManager,
    p: AlertCheckPayload,
  ): Promise<LowStockAlert | null> {
    const threshold = p.reorderPoint;
    const par = p.parLevel ?? 0;

    if (threshold <= 0) return null; // not configured for this item

    const open = await mgr.findOne(LowStockAlert, {
      where: {
        source: p.source,
        itemId: p.itemId,
        acknowledgedAt: IsNull(),
      },
    });

    // Stock recovered above PAR — auto-acknowledge any open alert.
    if (par > 0 && p.currentLevel >= par) {
      if (open) {
        open.acknowledgedAt = new Date();
        open.acknowledgedBy = 'system:auto-resolve';
        open.currentLevel = p.currentLevel;
        return mgr.save(LowStockAlert, open);
      }
      return null;
    }

    if (p.currentLevel > threshold) {
      // Above ROP and below PAR: a "watch" zone. We don't open a new alert
      // here unless one is already open; if open, just refresh its level.
      if (open) {
        open.currentLevel = p.currentLevel;
        return mgr.save(LowStockAlert, open);
      }
      return null;
    }

    // At or below ROP — alert territory.
    const severity: AlertSeverity = p.currentLevel <= 0 ? 'critical' : 'warning';

    if (open) {
      open.currentLevel = p.currentLevel;
      open.severity = severity;
      open.threshold = threshold;
      return mgr.save(LowStockAlert, open);
    }

    const alert = mgr.create(LowStockAlert, {
      source: p.source,
      itemId: p.itemId,
      itemName: p.itemName,
      warehouseId: p.warehouseId,
      currentLevel: p.currentLevel,
      threshold,
      severity,
    });
    return mgr.save(LowStockAlert, alert);
  }

  async findOpen(): Promise<LowStockAlert[]> {
    return this.alertsRepo.find({
      where: { acknowledgedAt: IsNull() },
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async findAll(includeAcknowledged?: boolean): Promise<LowStockAlert[]> {
    if (includeAcknowledged) {
      return this.alertsRepo.find({ order: { createdAt: 'DESC' } });
    }
    return this.findOpen();
  }

  async acknowledge(
    id: string,
    acknowledgedBy: string,
  ): Promise<LowStockAlert> {
    const alert = await this.alertsRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;
    return this.alertsRepo.save(alert);
  }
}
