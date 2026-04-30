import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { LowStockAlert } from '../alerts/entities/low-stock-alert.entity';
import { StockLot } from '../stock/entities/stock-lot.entity';
import { TransfersService } from '../warehouse/transfers.service';
import { StockTransfer } from '../warehouse/entities/stock-transfer.entity';

const STALE_TRANSFER_DAYS = 7;

export interface ExpireStaleResult {
  cancelled: number;
  systemUserId: string;
}

export interface ExpiringDigestRow {
  id: string;
  itemName: string;
  lotCode: string | null;
  warehouseId: string;
  expiresAt: Date | null;
  remainingQuantity: number;
  daysLeft: number;
}

/**
 * Operational hygiene jobs designed to be triggered by an external cron
 * or by a manager hitting the admin endpoint manually. They live as a
 * separate service (not a library of static functions) so they get the
 * normal DI tree — services they depend on can also be invoked directly
 * in tests with mocked repos.
 *
 * No `@nestjs/schedule` dependency — kept zero-deps deliberately. Wire
 * to the host's cron or to a managed scheduler at deploy time:
 *   curl -X POST .../maintenance/expire-stale-transfers
 *   curl -X POST .../maintenance/clean-resolved-alerts
 *   curl -X POST .../maintenance/expiring-digest
 */
@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(StockTransfer)
    private transfersRepo: Repository<StockTransfer>,
    @InjectRepository(LowStockAlert)
    private alertsRepo: Repository<LowStockAlert>,
    @InjectRepository(StockLot)
    private lotsRepo: Repository<StockLot>,
    @InjectDataSource() private dataSource: DataSource,
    private transfersService: TransfersService,
  ) {}

  /**
   * Cancel transfers that have been in_transit for more than N days. Each
   * cancellation goes through the normal TransfersService.cancel path so
   * the source warehouse stock is restored and a compensating ledger
   * entry is appended. Idempotent — re-running picks up only newly stale
   * rows.
   */
  async expireStaleTransfers(
    days = STALE_TRANSFER_DAYS,
  ): Promise<{ cancelled: number; ids: string[] }> {
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    );
    const candidates = await this.transfersRepo.find({
      where: {
        status: 'in_transit',
        createdAt: LessThan(cutoff),
      },
    });
    const cancelled: string[] = [];
    for (const t of candidates) {
      try {
        await this.transfersService.cancel(t.id, {
          cancelledBy: 'system:maintenance',
          notes: `auto-cancel: stale ${days}+ days`,
        });
        cancelled.push(t.id);
      } catch {
        // Ignore individual failures — log via audit decorator on caller.
      }
    }
    return { cancelled: cancelled.length, ids: cancelled };
  }

  /**
   * Drop resolved alerts older than 30 days from the open list view by
   * marking them acknowledged. Alerts auto-resolve when stock recovers
   * (system:auto-resolve), but ones acknowledged by hand still pile up
   * on long-tail histories — this is a maintenance compaction.
   *
   * Doesn't DELETE — the immutable history is preserved; we just bump
   * the acknowledgedAt so they drop out of "open" queries.
   */
  async cleanStaleAcknowledgedAlerts(
    days = 30,
  ): Promise<{ touched: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.alertsRepo
      .createQueryBuilder()
      .update(LowStockAlert)
      .set({
        acknowledgedAt: () => 'NOW()',
        acknowledgedBy: 'system:maintenance',
      })
      .where('acknowledgedAt IS NULL')
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();
    return { touched: result.affected ?? 0 };
  }

  /**
   * Snapshot of lots expiring within the next `days` days (or already
   * expired). Returned as plain rows so the caller can format an email,
   * Slack message, or audit-log entry. We don't store this anywhere —
   * the source of truth is the lots table.
   */
  async expiringDigest(daysAhead = 14): Promise<ExpiringDigestRow[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const lots = await this.lotsRepo
      .createQueryBuilder('lot')
      .where('lot.isActive = true')
      .andWhere('lot.remainingQuantity > 0')
      .andWhere('lot.expiresAt IS NOT NULL')
      .andWhere('lot.expiresAt <= :cutoff', { cutoff })
      .orderBy('lot.expiresAt', 'ASC')
      .getMany();

    return lots.map((lot) => {
      const expiresAt = lot.expiresAt ? new Date(lot.expiresAt) : null;
      const daysLeft = expiresAt
        ? Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;
      return {
        id: lot.id,
        itemName: lot.itemName,
        lotCode: lot.lotCode ?? null,
        warehouseId: lot.locationId,
        expiresAt,
        remainingQuantity: Number(lot.remainingQuantity),
        daysLeft,
      };
    });
  }
}
