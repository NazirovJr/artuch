import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import {
  LocationKind,
  StockLevel,
  StockSource,
} from './entities/stock-level.entity';
import { StockLot } from './entities/stock-lot.entity';
import { StockMovement } from './entities/stock-movement.entity';

export interface ReceiveLotParams {
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  quantity: number;
  receivedAt?: Date;
  expiresAt?: Date | string | null;
  lotCode?: string | null;
  unitCost?: number;
  supplierName?: string;
  supplierId?: string;
  notes?: string;
  performedBy: string;
  performedByName?: string;
  idempotencyKey?: string;
}

export interface ConsumeFEFOParams {
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  quantity: number;
  type: 'issue' | 'sale' | 'writeoff' | 'transfer_out' | 'return_supplier';
  performedBy: string;
  performedByName?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  counterparty?: string;
  idempotencyKey?: string;
}

@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(StockLot)
    private lotsRepo: Repository<StockLot>,
    @InjectRepository(StockLevel)
    private levelsRepo: Repository<StockLevel>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /**
   * Atomic lot receipt: inserts a new lot row, increments the StockLevel,
   * appends a 'receipt' movement carrying lotId/lotCode for audit. Idempotent
   * on idempotencyKey.
   */
  async receiveLot(
    p: ReceiveLotParams,
    mgr?: EntityManager,
  ): Promise<{ lot: StockLot; movement: StockMovement }> {
    const run = async (m: EntityManager) => {
      if (p.idempotencyKey) {
        const existing = await m.findOne(StockMovement, {
          where: { idempotencyKey: p.idempotencyKey },
        });
        if (existing && existing.lotId) {
          const lot = await m.findOne(StockLot, {
            where: { id: existing.lotId },
          });
          if (lot) return { lot, movement: existing };
        }
      }

      const qty = Number(p.quantity);
      if (qty <= 0) {
        throw new BadRequestException('quantity must be positive');
      }

      // Lock the stock level row first to serialise concurrent receives.
      let level = await m.findOne(StockLevel, {
        where: {
          source: p.source,
          itemId: p.itemId,
          locationId: p.locationId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!level) {
        level = m.create(StockLevel, {
          source: p.source,
          itemId: p.itemId,
          locationId: p.locationId,
          locationKind: p.locationKind,
          quantity: 0,
          reservedQuantity: 0,
        });
        level = await m.save(StockLevel, level);
      }

      const lot = m.create(StockLot, {
        source: p.source,
        itemId: p.itemId,
        itemName: p.itemName,
        locationId: p.locationId,
        locationKind: p.locationKind,
        lotCode: p.lotCode ?? undefined,
        receivedAt: p.receivedAt ?? new Date(),
        expiresAt: p.expiresAt ? new Date(p.expiresAt) : undefined,
        originalQuantity: qty,
        remainingQuantity: qty,
        unitCost: p.unitCost,
        supplierName: p.supplierName,
        supplierId: p.supplierId,
        notes: p.notes,
        isActive: true,
      });
      const savedLot = await m.save(StockLot, lot);

      level.quantity = Number(level.quantity) + qty;
      await m.save(StockLevel, level);

      const movement = m.create(StockMovement, {
        source: p.source,
        itemId: p.itemId,
        itemName: p.itemName,
        locationId: p.locationId,
        locationKind: p.locationKind,
        type: 'receipt',
        quantity: qty,
        balanceAfter: Number(level.quantity),
        reservedAfter: Number(level.reservedQuantity),
        performedBy: p.performedBy,
        performedByName: p.performedByName,
        notes: p.notes,
        counterparty: p.supplierName,
        unitCost: p.unitCost,
        totalCost: p.unitCost ? p.unitCost * qty : undefined,
        lotId: savedLot.id,
        lotCode: savedLot.lotCode,
        idempotencyKey: p.idempotencyKey,
      });
      const savedMovement = await m.save(StockMovement, movement);

      // Backfill the lot's receivedMovementId now that we have it.
      savedLot.receivedMovementId = savedMovement.id;
      await m.save(StockLot, savedLot);

      return { lot: savedLot, movement: savedMovement };
    };
    return mgr ? run(mgr) : this.dataSource.transaction((m) => run(m));
  }

  /**
   * FEFO consumption: walk the active lots for (source, itemId, locationId)
   * sorted by `expiresAt ASC NULLS LAST, receivedAt ASC` and consume from
   * each until the requested quantity is satisfied. Emits one StockMovement
   * per lot consumed (granular audit). Atomic; idempotent on idempotencyKey
   * (the *first* movement of the run carries the key — the rest are derived).
   *
   * If no lots exist for the item, the caller should fall back to
   * StockService.apply() with a plain decrement. We don't auto-fallback
   * here so the caller can decide policy.
   */
  async consumeFEFO(
    p: ConsumeFEFOParams,
    mgr?: EntityManager,
  ): Promise<StockMovement[]> {
    const run = async (m: EntityManager) => {
      if (p.idempotencyKey) {
        const existing = await m.find(StockMovement, {
          where: { idempotencyKey: p.idempotencyKey },
        });
        if (existing.length > 0) return existing;
      }

      const totalQty = Number(p.quantity);
      if (totalQty <= 0) {
        throw new BadRequestException('quantity must be positive');
      }

      // Lock the level row to serialise issues against concurrent receipts.
      const level = await m.findOne(StockLevel, {
        where: {
          source: p.source,
          itemId: p.itemId,
          locationId: p.locationId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!level) {
        throw new NotFoundException('No stock for this item at this location');
      }
      if (Number(level.quantity) - totalQty < 0) {
        throw new BadRequestException(
          `Insufficient stock: have ${level.quantity}, need ${totalQty}`,
        );
      }

      // Lock affected lots in FEFO order. PostgreSQL FOR UPDATE on a sorted
      // SELECT preserves order. NULL expiresAt sorts last so non-perishable
      // lots are consumed only after dated stock is exhausted.
      const lots = await m
        .createQueryBuilder(StockLot, 'lot')
        .where('lot.source = :source', { source: p.source })
        .andWhere('lot.itemId = :itemId', { itemId: p.itemId })
        .andWhere('lot.locationId = :locationId', {
          locationId: p.locationId,
        })
        .andWhere('lot.isActive = true')
        .andWhere('lot.remainingQuantity > 0')
        .orderBy('lot.expiresAt', 'ASC', 'NULLS LAST')
        .addOrderBy('lot.receivedAt', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const totalRemaining = lots.reduce(
        (s, l) => s + Number(l.remainingQuantity),
        0,
      );
      if (totalRemaining < totalQty) {
        throw new BadRequestException(
          `Lots only cover ${totalRemaining} of ${totalQty}; reconcile StockLevel`,
        );
      }

      let toConsume = totalQty;
      const movements: StockMovement[] = [];
      let isFirstMovement = true;

      for (const lot of lots) {
        if (toConsume <= 0) break;
        const remaining = Number(lot.remainingQuantity);
        const take = Math.min(remaining, toConsume);

        lot.remainingQuantity = remaining - take;
        if (lot.remainingQuantity <= 0) {
          lot.isActive = false;
        }
        await m.save(StockLot, lot);

        toConsume -= take;
        const newLevelQty = Number(level.quantity) - (totalQty - toConsume);
        // ^ as we walk lots, the running level is the original minus
        //   (totalQty - toConsume) consumed so far. balanceAfter for the
        //   movement reflects post-this-lot state.

        const movement = m.create(StockMovement, {
          source: p.source,
          itemId: p.itemId,
          itemName: p.itemName,
          locationId: p.locationId,
          locationKind: p.locationKind,
          type: p.type,
          quantity: take,
          balanceAfter: newLevelQty,
          reservedAfter: Number(level.reservedQuantity),
          performedBy: p.performedBy,
          performedByName: p.performedByName,
          referenceType: p.referenceType,
          referenceId: p.referenceId,
          notes: p.notes,
          counterparty: p.counterparty,
          unitCost: lot.unitCost,
          totalCost: lot.unitCost ? Number(lot.unitCost) * take : undefined,
          lotId: lot.id,
          lotCode: lot.lotCode,
          idempotencyKey: isFirstMovement ? p.idempotencyKey : undefined,
        });
        movements.push(await m.save(StockMovement, movement));
        isFirstMovement = false;
      }

      level.quantity = Number(level.quantity) - totalQty;
      await m.save(StockLevel, level);

      return movements;
    };
    return mgr ? run(mgr) : this.dataSource.transaction((m) => run(m));
  }

  /**
   * True if this item+location has at least one active lot — meaning
   * issues should go through FEFO. Used by callers to decide between
   * `consumeFEFO` and the plain `StockService.apply` path.
   */
  async isLotTracked(p: {
    source: StockSource;
    itemId: string;
    locationId: string;
  }): Promise<boolean> {
    const count = await this.lotsRepo.count({
      where: {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
        isActive: true,
        remainingQuantity: MoreThan(0) as any,
      },
    });
    return count > 0;
  }

  // ─── Read APIs ────────────────────────────────────────────────────

  async findActiveLots(p: {
    source?: StockSource;
    itemId?: string;
    locationId?: string;
  }): Promise<StockLot[]> {
    const where: any = { isActive: true };
    if (p.source) where.source = p.source;
    if (p.itemId) where.itemId = p.itemId;
    if (p.locationId) where.locationId = p.locationId;
    return this.lotsRepo.find({
      where,
      order: { expiresAt: 'ASC', receivedAt: 'ASC' },
    });
  }

  /**
   * Lots expiring within `daysAhead` days. Excludes already-expired (those
   * are a separate, more urgent concern — handled by consumers polling).
   * Caller can pass `includeExpired: true` to get both buckets.
   */
  async findExpiringSoon(
    daysAhead: number,
    includeExpired = false,
  ): Promise<StockLot[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const qb = this.lotsRepo
      .createQueryBuilder('lot')
      .where('lot.isActive = true')
      .andWhere('lot.remainingQuantity > 0')
      .andWhere('lot.expiresAt IS NOT NULL')
      .andWhere('lot.expiresAt <= :cutoff', { cutoff });
    if (!includeExpired) {
      qb.andWhere('lot.expiresAt >= :now', { now });
    }
    return qb.orderBy('lot.expiresAt', 'ASC').getMany();
  }
}
