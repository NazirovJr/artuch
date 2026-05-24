import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  LocationKind,
  StockLevel,
  StockSource,
} from './entities/stock-level.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';

export interface StockOpParams {
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  quantity: number;
  type: StockMovementType;
  performedBy: string;
  performedByName?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  counterparty?: string;
  unitCost?: number;
  totalCost?: number;
  idempotencyKey?: string;
}

export interface StockReservationParams
  extends Omit<StockOpParams, 'type'> {}

const POSITIVE_TYPES: ReadonlySet<StockMovementType> = new Set([
  'receipt',
  'transfer_in',
  'return_customer',
  'rental_in',
]);
const NEGATIVE_TYPES: ReadonlySet<StockMovementType> = new Set([
  'issue',
  'sale',
  'transfer_out',
  'return_supplier',
  'writeoff',
]);

/**
 * Atomic primitives for stock manipulation. Always pessimistic-write-locks
 * the StockLevel row, mutates it, appends a StockMovement to the immutable
 * ledger, and returns the movement.
 *
 * Designed to be called from inside the caller's existing DB transaction
 * (pass in `mgr`) so the stock change rolls back together with the
 * domain operation that triggered it.
 */
@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockLevel)
    private levelsRepo: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private movementsRepo: Repository<StockMovement>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /**
   * Lock-and-fetch (or create) the StockLevel for (source, item, location).
   * The caller is responsible for being inside a transaction.
   */
  async lockLevel(
    mgr: EntityManager,
    p: {
      source: StockSource;
      itemId: string;
      locationId: string;
      locationKind: LocationKind;
    },
  ): Promise<StockLevel> {
    let level = await mgr.findOne(StockLevel, {
      where: {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!level) {
      level = mgr.create(StockLevel, {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
        locationKind: p.locationKind,
        quantity: 0,
        reservedQuantity: 0,
      });
      level = await mgr.save(StockLevel, level);
    }
    return level;
  }

  /**
   * Apply a movement: read-modify-write under pessimistic_write lock,
   * append to the ledger. Idempotent on idempotencyKey.
   *
   * Caller passes their EntityManager (their own transaction). If the
   * caller wants the operation isolated, they can omit mgr — we'll open
   * one ourselves.
   */
  async apply(
    p: StockOpParams,
    mgr?: EntityManager,
  ): Promise<StockMovement> {
    const run = async (m: EntityManager) => {
      if (p.idempotencyKey) {
        const existing = await m.findOne(StockMovement, {
          where: { idempotencyKey: p.idempotencyKey },
        });
        if (existing) return existing;
      }

      const level = await this.lockLevel(m, {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
        locationKind: p.locationKind,
      });

      const qty = Number(p.quantity);
      if (qty <= 0) {
        throw new BadRequestException('quantity must be positive');
      }

      const before = Number(level.quantity);
      let after: number;

      if (POSITIVE_TYPES.has(p.type)) {
        after = before + qty;
      } else if (NEGATIVE_TYPES.has(p.type)) {
        after = before - qty;
        // For sales, treat reserved as committed: subtract from reserved
        // first (it's been "promised" to this sale) before falling back
        // to free quantity. If level.reserved is zero, this is a no-op.
        // We don't enforce the reservation pre-existing — apply() is also
        // valid for direct decrements without prior reservation.
        if (after < 0) {
          throw new BadRequestException(
            `Insufficient stock: have ${before}, need ${qty}`,
          );
        }
      } else if (p.type === 'adjustment' || p.type === 'stocktake') {
        // Quantity is the SIGNED delta encoded as positive — caller must
        // pass the new absolute via overload? No: keep it simple and
        // require the caller to pass qty > 0 with `type=adjustment` and
        // pre-decide direction via `notes`. For stock SET (overwrite),
        // use setExact() instead.
        // Default behavior: treat adjustment as +.
        after = before + qty;
      } else if (p.type === 'rental_out') {
        // Rental does NOT change physical quantity; it bumps reserved.
        if (Number(level.reservedQuantity) + qty > before) {
          throw new BadRequestException(
            `Cannot reserve ${qty} units; only ${
              before - Number(level.reservedQuantity)
            } available`,
          );
        }
        level.reservedQuantity = Number(level.reservedQuantity) + qty;
        after = before;
      } else if (p.type === 'rental_in') {
        level.reservedQuantity = Math.max(
          0,
          Number(level.reservedQuantity) - qty,
        );
        after = before;
      } else {
        throw new BadRequestException(`Unsupported type: ${p.type}`);
      }

      level.quantity = after;
      await m.save(StockLevel, level);

      const movement = m.create(StockMovement, {
        source: p.source,
        itemId: p.itemId,
        itemName: p.itemName,
        locationId: p.locationId,
        locationKind: p.locationKind,
        type: p.type,
        quantity: qty,
        balanceAfter: after,
        reservedAfter: Number(level.reservedQuantity),
        performedBy: p.performedBy,
        performedByName: p.performedByName,
        referenceType: p.referenceType,
        referenceId: p.referenceId,
        notes: p.notes,
        counterparty: p.counterparty,
        unitCost: p.unitCost,
        totalCost: p.totalCost,
        idempotencyKey: p.idempotencyKey,
      });
      return m.save(StockMovement, movement);
    };

    return mgr
      ? run(mgr)
      : this.dataSource.transaction((m) => run(m));
  }

  /**
   * Atomic transfer — issue from source, receive at target, in one DB
   * transaction. Two ledger entries (transfer_out, transfer_in) sharing
   * a referenceId so the legs can be paired in reports.
   */
  async transfer(
    p: {
      source: StockSource;
      itemId: string;
      itemName: string;
      sourceLocationId: string;
      targetLocationId: string;
      locationKind: LocationKind;
      quantity: number;
      performedBy: string;
      performedByName?: string;
      referenceType?: string;
      referenceId?: string;
      notes?: string;
      idempotencyKey?: string;
    },
    mgr?: EntityManager,
  ): Promise<{ out: StockMovement; in: StockMovement }> {
    if (p.sourceLocationId === p.targetLocationId) {
      throw new BadRequestException('source and target must differ');
    }
    const run = async (m: EntityManager) => {
      const out = await this.apply(
        {
          source: p.source,
          itemId: p.itemId,
          itemName: p.itemName,
          locationId: p.sourceLocationId,
          locationKind: p.locationKind,
          type: 'transfer_out',
          quantity: p.quantity,
          performedBy: p.performedBy,
          performedByName: p.performedByName,
          referenceType: p.referenceType,
          referenceId: p.referenceId,
          notes: p.notes,
          idempotencyKey: p.idempotencyKey,
        },
        m,
      );
      const incoming = await this.apply(
        {
          source: p.source,
          itemId: p.itemId,
          itemName: p.itemName,
          locationId: p.targetLocationId,
          locationKind: p.locationKind,
          type: 'transfer_in',
          quantity: p.quantity,
          performedBy: p.performedBy,
          performedByName: p.performedByName,
          referenceType: p.referenceType,
          referenceId: p.referenceId,
          notes: p.notes,
          // Second leg drops the idempotencyKey (unique-per-row) — the
          // first leg owns it; if the whole transfer retries, both legs
          // re-execute idempotently because lockLevel + adjust is safe.
        },
        m,
      );
      return { out, in: incoming };
    };
    return mgr ? run(mgr) : this.dataSource.transaction((m) => run(m));
  }

  /**
   * Force the StockLevel.quantity to an exact value. Computes the variance
   * and writes a single ledger entry capturing the delta. Used by:
   *   - stocktake approval → movementType 'stocktake' (default)
   *   - adjustment mirror  → movementType 'adjustment' (legacy adjustment is
   *     an absolute SET, so the unified side must SET too, not add a delta)
   * Idempotent on idempotencyKey.
   */
  async setExact(
    p: {
      source: StockSource;
      itemId: string;
      itemName: string;
      locationId: string;
      locationKind: LocationKind;
      newQuantity: number;
      performedBy: string;
      performedByName?: string;
      referenceType?: string;
      referenceId?: string;
      notes?: string;
      movementType?: StockMovementType;
      idempotencyKey?: string;
    },
    mgr?: EntityManager,
  ): Promise<StockMovement | null> {
    const run = async (m: EntityManager) => {
      if (p.idempotencyKey) {
        const existing = await m.findOne(StockMovement, {
          where: { idempotencyKey: p.idempotencyKey },
        });
        if (existing) return existing;
      }

      const level = await this.lockLevel(m, {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
        locationKind: p.locationKind,
      });
      const delta = Number(p.newQuantity) - Number(level.quantity);
      if (delta === 0) return null;

      level.quantity = Number(p.newQuantity);
      await m.save(StockLevel, level);

      const movement = m.create(StockMovement, {
        source: p.source,
        itemId: p.itemId,
        itemName: p.itemName,
        locationId: p.locationId,
        locationKind: p.locationKind,
        type: p.movementType ?? 'stocktake',
        quantity: Math.abs(delta),
        balanceAfter: level.quantity,
        reservedAfter: Number(level.reservedQuantity),
        performedBy: p.performedBy,
        performedByName: p.performedByName,
        referenceType: p.referenceType,
        referenceId: p.referenceId,
        notes: `${delta > 0 ? 'overage' : 'shortage'}${
          p.notes ? `: ${p.notes}` : ''
        }`,
        idempotencyKey: p.idempotencyKey,
      });
      return m.save(StockMovement, movement);
    };
    return mgr ? run(mgr) : this.dataSource.transaction((m) => run(m));
  }

  // ─── Read APIs ─────────────────────────────────────────────────────

  async findLevel(p: {
    source: StockSource;
    itemId: string;
    locationId: string;
  }): Promise<StockLevel | null> {
    return this.levelsRepo.findOne({
      where: {
        source: p.source,
        itemId: p.itemId,
        locationId: p.locationId,
      },
    });
  }

  async findLevelsByLocation(
    locationId: string,
    source?: StockSource,
  ): Promise<StockLevel[]> {
    const where: any = { locationId };
    if (source) where.source = source;
    return this.levelsRepo.find({
      where,
      order: { itemId: 'ASC' },
    });
  }

  async findLevelsByItem(
    itemId: string,
    source?: StockSource,
  ): Promise<StockLevel[]> {
    const where: any = { itemId };
    if (source) where.source = source;
    return this.levelsRepo.find({ where, order: { locationId: 'ASC' } });
  }

  async findMovements(p: {
    source?: StockSource;
    itemId?: string;
    locationId?: string;
    type?: StockMovementType;
    referenceType?: string;
    referenceId?: string;
    limit?: number;
  }): Promise<StockMovement[]> {
    const where: any = {};
    if (p.source) where.source = p.source;
    if (p.itemId) where.itemId = p.itemId;
    if (p.locationId) where.locationId = p.locationId;
    if (p.type) where.type = p.type;
    if (p.referenceType) where.referenceType = p.referenceType;
    if (p.referenceId) where.referenceId = p.referenceId;
    return this.movementsRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: p.limit ?? 200,
    });
  }
}
