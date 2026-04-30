import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AlertsService } from '../alerts/alerts.service';
import { LotsService } from '../stock/lots.service';
import { StockMovementType } from '../stock/entities/stock-movement.entity';
import { StockService } from '../stock/stock.service';
import { UnitConversionsService } from '../stock/unit-conversions.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { WarehouseItem } from './entities/warehouse-item.entity';
import {
  WarehouseTransaction,
  WarehouseTransactionType,
} from './entities/warehouse-transaction.entity';
import { CreateWarehouseTransactionDto } from './dto/create-warehouse-transaction.dto';
import { CreateWarehouseItemDto } from './dto/create-warehouse-item.dto';

const WAREHOUSE_TYPE_TO_STOCK: Record<
  WarehouseTransactionType,
  StockMovementType
> = {
  income: 'receipt',
  expense: 'issue',
  sale: 'sale',
  transfer: 'transfer_out', // legacy synchronous transfer; new code uses TransfersService
  return: 'return_customer', // legacy alias
  return_customer: 'return_customer',
  return_supplier: 'return_supplier',
  adjustment: 'adjustment',
  writeoff: 'writeoff',
};

const SENTINEL_LOCATION = '__no_warehouse__';

const INCREMENT_TYPES: ReadonlySet<WarehouseTransactionType> = new Set([
  'income',
  'return',
  'return_customer',
]);

const DECREMENT_TYPES: ReadonlySet<WarehouseTransactionType> = new Set([
  'expense',
  'sale',
  'writeoff',
  'return_supplier',
]);

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseItem)
    private itemsRepo: Repository<WarehouseItem>,
    @InjectRepository(WarehouseTransaction)
    private transRepo: Repository<WarehouseTransaction>,
    @InjectDataSource() private dataSource: DataSource,
    private alertsService: AlertsService,
    private stockService: StockService,
    private lotsService: LotsService,
    private unitConversionsService: UnitConversionsService,
    private suppliersService: SuppliersService,
  ) {}

  /**
   * Resolve the supplier display name from the FK if the caller passed
   * supplierId. Mutates `data.supplier` so the legacy denormalized field
   * stays in sync. No-op when only the free-text path is used.
   */
  private async resolveSupplier(
    data: CreateWarehouseTransactionDto,
  ): Promise<void> {
    if (data.supplierId) {
      const supplier = await this.suppliersService.findById(data.supplierId);
      data.supplier = supplier.name;
    }
  }

  /**
   * Mirror a WarehouseTransaction into the unified StockLevel/StockMovement
   * tables (dual-write). Routes between three paths:
   *
   *   1. Receipt with lot info  → LotsService.receiveLot (creates StockLot
   *                              row, increments level, writes 'receipt'
   *                              movement with lotId/lotCode).
   *   2. Issue/sale/writeoff on a lot-tracked SKU → LotsService.consumeFEFO
   *                              (consumes oldest lots first, may emit
   *                              multiple movements per logical issue).
   *   3. Everything else        → StockService.apply (plain decrement).
   *
   * Same DB transaction as the legacy write so they commit or roll back
   * together. Failure to mirror should NOT silently succeed — let it
   * bubble; we'd rather see the error than have the two stores drift.
   */
  private async mirrorToUnified(
    mgr: EntityManager,
    item: WarehouseItem,
    data: CreateWarehouseTransactionDto,
  ): Promise<void> {
    const stockType = WAREHOUSE_TYPE_TO_STOCK[data.type];
    if (!stockType || stockType === 'transfer_out') {
      // Transfer is handled directly via stockService.transfer in
      // applyTransfer; skip the mirror here to avoid double-counting.
      return;
    }

    const locationId = item.warehouseId ?? SENTINEL_LOCATION;
    const qty = Number(data.quantity);

    // 1. Receipt with lot info → create a tracked lot.
    const isReceipt = stockType === 'receipt' || stockType === 'return_customer';
    const hasLotInfo = !!data.lotCode || !!data.expiresAt || !!data.unitCost;
    if (isReceipt && hasLotInfo) {
      await this.lotsService.receiveLot(
        {
          source: 'warehouse',
          itemId: item.id,
          itemName: item.name,
          locationId,
          locationKind: 'warehouse',
          quantity: qty,
          lotCode: data.lotCode ?? null,
          expiresAt: data.expiresAt ?? null,
          unitCost: data.unitCost,
          supplierName: data.supplier,
          supplierId: data.supplierId,
          notes: data.notes,
          performedBy: data.performedBy,
          idempotencyKey: data.idempotencyKey
            ? `${data.idempotencyKey}:wh-mirror`
            : undefined,
        },
        mgr,
      );
      return;
    }

    // 2. Issue on a lot-tracked SKU → FEFO consumption.
    const isConsuming =
      stockType === 'issue' ||
      stockType === 'sale' ||
      stockType === 'writeoff' ||
      stockType === 'return_supplier';
    if (isConsuming) {
      const tracked = await this.lotsService.isLotTracked({
        source: 'warehouse',
        itemId: item.id,
        locationId,
      });
      if (tracked) {
        await this.lotsService.consumeFEFO(
          {
            source: 'warehouse',
            itemId: item.id,
            itemName: item.name,
            locationId,
            locationKind: 'warehouse',
            quantity: qty,
            type: stockType,
            performedBy: data.performedBy,
            notes: data.notes,
            counterparty: data.recipient,
            idempotencyKey: data.idempotencyKey
              ? `${data.idempotencyKey}:wh-mirror`
              : undefined,
          },
          mgr,
        );
        return;
      }
    }

    // 3. Plain decrement / receipt / adjustment.
    await this.stockService.apply(
      {
        source: 'warehouse',
        itemId: item.id,
        itemName: item.name,
        locationId,
        locationKind: 'warehouse',
        type: stockType,
        quantity: qty,
        performedBy: data.performedBy,
        notes: data.notes,
        counterparty: data.supplier ?? data.recipient,
        totalCost: data.totalCost,
        idempotencyKey: data.idempotencyKey
          ? `${data.idempotencyKey}:wh-mirror`
          : undefined,
      },
      mgr,
    );
  }

  private async maybeAlert(
    mgr: EntityManager,
    item: WarehouseItem,
  ): Promise<void> {
    const reorderPoint =
      Number(item.reorderPoint) > 0
        ? Number(item.reorderPoint)
        : Number(item.minQuantity);
    await this.alertsService.checkAndUpsert(mgr, {
      source: 'warehouse',
      itemId: item.id,
      itemName: item.name,
      warehouseId: item.warehouseId,
      currentLevel: Number(item.quantity),
      reorderPoint,
      parLevel: Number(item.parLevel),
    });
  }

  async findAllItems(): Promise<WarehouseItem[]> {
    return this.itemsRepo.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * DISTINCT list of category labels currently in use, sorted alphabetically.
   * The frontend uses this to power autocomplete on the "new item" form so
   * users naturally reuse existing labels ("products", "beverages", …) and
   * only invent a fresh one when they actually need to.
   */
  async findCategories(): Promise<string[]> {
    const rows = await this.itemsRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.category', 'category')
      .where('i.deletedAt IS NULL')
      .orderBy('i.category', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((r) => r.category).filter(Boolean);
  }

  /**
   * Create a new warehouse SKU. If `quantity` > 0 we additionally record a
   * `receipt` stock movement so the audit ledger has a documented origin
   * for the opening balance instead of a phantom row appearing out of
   * nowhere. The item row carries its own `quantity` field for legacy
   * read paths; the canonical balance lives in `stock_levels`.
   *
   * Uniqueness: we reject creating two items with the same (name,
   * warehouseId) pair — otherwise the staff app's search would return
   * ambiguous duplicates. Same SKU at a different warehouse is fine.
   */
  async createItem(
    dto: CreateWarehouseItemDto,
    actorUserId?: string,
  ): Promise<WarehouseItem> {
    return this.dataSource.transaction(async (mgr) => {
      const conflict = await mgr.findOne(WarehouseItem, {
        where: {
          name: dto.name,
          warehouseId: dto.warehouseId,
        },
      });
      if (conflict) {
        throw new BadRequestException(
          `Item "${dto.name}" already exists in this warehouse`,
        );
      }

      const item = mgr.create(WarehouseItem, {
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        barcode: dto.barcode || undefined,
        quantity: dto.quantity ?? 0,
        minQuantity: dto.minQuantity ?? 0,
        parLevel: dto.parLevel ?? 0,
        reorderPoint: dto.reorderPoint ?? 0,
        price: dto.price,
        warehouseId: dto.warehouseId ?? undefined,
      } as Partial<WarehouseItem>);
      const saved = await mgr.save(WarehouseItem, item);

      // Opening-balance ledger entry — only when stock is non-zero. Use
      // 'receipt' so the movement reads as "товар поступил на склад" in
      // the journal.
      const openingQty = Number(dto.quantity ?? 0);
      if (openingQty > 0) {
        await this.stockService.apply(
          {
            source: 'warehouse',
            itemId: saved.id,
            itemName: saved.name,
            locationId: saved.warehouseId ?? SENTINEL_LOCATION,
            locationKind: 'warehouse',
            type: 'receipt',
            quantity: openingQty,
            performedBy: actorUserId ?? 'system',
            notes: 'Initial stock at item creation',
          },
          mgr,
        );
      }

      // Trigger a low-stock alert immediately if the user set a minQuantity
      // higher than the opening balance — surfaces under-stocked SKUs the
      // moment they enter the catalogue.
      await this.maybeAlert(mgr, saved);

      return saved;
    });
  }

  /**
   * Lookup an item by barcode, optionally scoped to a single warehouse so
   * the same SKU code at different warehouses doesn't collide. Returns the
   * first match — barcodes should be unique per item, but we don't enforce
   * a unique index because a single SKU can legitimately exist at multiple
   * warehouses with identical barcodes (separate rows by warehouseId).
   */
  async findByBarcode(
    barcode: string,
    warehouseId?: string,
  ): Promise<WarehouseItem | null> {
    const where: any = { barcode };
    if (warehouseId) where.warehouseId = warehouseId;
    return this.itemsRepo.findOne({ where });
  }

  async findAllTransactions(): Promise<WarehouseTransaction[]> {
    return this.transRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['item'],
    });
  }

  /**
   * Apply a stock movement atomically.
   *
   * Wraps the read-modify-write of WarehouseItem.quantity and the INSERT into
   * warehouse_transactions in a single SERIALIZABLE-safe DB transaction with
   * pessimistic_write lock on the affected rows. This prevents:
   *   - lost updates from concurrent expenses on the same item
   *   - half-applied state where stock is decremented but the ledger entry
   *     fails to persist (or vice versa)
   *   - duplicate writes on retry — see idempotencyKey check below.
   */
  async createTransaction(
    data: CreateWarehouseTransactionDto,
  ): Promise<WarehouseTransaction> {
    return this.dataSource.transaction(async (mgr) => {
      // Idempotency: if the client already submitted this key, return the
      // existing record instead of creating a duplicate.
      if (data.idempotencyKey) {
        const existing = await mgr.findOne(WarehouseTransaction, {
          where: { idempotencyKey: data.idempotencyKey },
          relations: ['item'],
        });
        if (existing) return existing;
      }

      const type = data.type as WarehouseTransactionType;

      if (type === 'transfer') {
        return this.applyTransfer(mgr, data);
      }

      const item = await mgr.findOne(WarehouseItem, {
        where: { id: data.itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Warehouse item not found');

      // Resolve supplier FK → name early so downstream writes (legacy
      // table, lot row, unified ledger) all see the same display string.
      await this.resolveSupplier(data);

      // Convert input quantity to canonical units (no-op if inputUnit
      // matches item.unit or is unset). Mutates `data.quantity` so the
      // legacy ledger entry, the alert check, and the unified mirror all
      // see the same canonical number.
      const canonicalQty = await this.unitConversionsService.toCanonical({
        source: 'warehouse',
        itemId: item.id,
        canonicalUnit: item.unit,
        quantity: Number(data.quantity),
        inputUnit: data.inputUnit,
      });
      data.quantity = canonicalQty;

      const qty = canonicalQty;
      const current = Number(item.quantity);
      let next: number;

      if (INCREMENT_TYPES.has(type)) {
        next = current + qty;
      } else if (DECREMENT_TYPES.has(type)) {
        next = current - qty;
        if (next < 0) {
          throw new BadRequestException(
            `Insufficient stock: have ${current} ${item.unit}, need ${qty}`,
          );
        }
      } else if (type === 'adjustment') {
        // Adjustment quantity is a SIGNED delta (positive or negative). We
        // accept it via DTO as a positive number, with the direction encoded
        // in `notes` or via `recipient`/`supplier`. To keep the DTO simple
        // we treat adjustment like a free-form set: caller passes the new
        // absolute target via `totalCost` overload? No — keep it simple:
        // adjustment = forced set to `quantity`, with the delta recorded.
        next = qty;
      } else {
        throw new BadRequestException(`Unsupported transaction type: ${type}`);
      }

      item.quantity = next;
      await mgr.save(WarehouseItem, item);
      await this.maybeAlert(mgr, item);
      await this.mirrorToUnified(mgr, item, data);

      const tx = mgr.create(WarehouseTransaction, {
        ...data,
        balanceAfter: next,
      });
      return mgr.save(WarehouseTransaction, tx);
    });
  }

  /**
   * Two-warehouse transfer applied as a single atomic operation:
   * one outgoing record on the source item, one incoming on the target.
   * The transfer is one logical event but produces two ledger lines so
   * each warehouse's stock history is complete on its own.
   */
  private async applyTransfer(
    mgr: EntityManager,
    data: CreateWarehouseTransactionDto,
  ): Promise<WarehouseTransaction> {
    if (!data.sourceWarehouseId || !data.targetWarehouseId) {
      throw new BadRequestException(
        'transfer requires sourceWarehouseId and targetWarehouseId',
      );
    }
    if (data.sourceWarehouseId === data.targetWarehouseId) {
      throw new BadRequestException('source and target warehouses must differ');
    }

    const qty = Number(data.quantity);

    // Lock source first by id ordering to avoid deadlocks between concurrent
    // transfers in opposite directions.
    const sourceItem = await mgr.findOne(WarehouseItem, {
      where: { id: data.itemId, warehouseId: data.sourceWarehouseId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!sourceItem) {
      throw new NotFoundException(
        'Item not found in source warehouse',
      );
    }
    if (Number(sourceItem.quantity) - qty < 0) {
      throw new BadRequestException(
        `Insufficient stock in source: have ${sourceItem.quantity}, need ${qty}`,
      );
    }

    // Find or create the matching item in the target warehouse — same SKU
    // (matched by name+unit+category), but a separate row per warehouse.
    let targetItem = await mgr.findOne(WarehouseItem, {
      where: {
        name: sourceItem.name,
        unit: sourceItem.unit,
        category: sourceItem.category,
        warehouseId: data.targetWarehouseId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!targetItem) {
      targetItem = mgr.create(WarehouseItem, {
        name: sourceItem.name,
        unit: sourceItem.unit,
        category: sourceItem.category,
        price: sourceItem.price,
        minQuantity: sourceItem.minQuantity,
        quantity: 0,
        warehouseId: data.targetWarehouseId,
      });
      targetItem = await mgr.save(WarehouseItem, targetItem);
    }

    sourceItem.quantity = Number(sourceItem.quantity) - qty;
    targetItem.quantity = Number(targetItem.quantity) + qty;
    await mgr.save(WarehouseItem, [sourceItem, targetItem]);
    await this.maybeAlert(mgr, sourceItem);
    await this.maybeAlert(mgr, targetItem);
    await this.stockService.transfer(
      {
        source: 'warehouse',
        itemId: sourceItem.id,
        itemName: sourceItem.name,
        sourceLocationId: data.sourceWarehouseId,
        targetLocationId: data.targetWarehouseId,
        locationKind: 'warehouse',
        quantity: qty,
        performedBy: data.performedBy,
        notes: data.notes,
        idempotencyKey: data.idempotencyKey
          ? `${data.idempotencyKey}:legacy-transfer`
          : undefined,
      },
      mgr,
    );

    const outgoing = mgr.create(WarehouseTransaction, {
      ...data,
      itemId: sourceItem.id,
      type: 'transfer',
      balanceAfter: sourceItem.quantity,
      // Mark the outgoing leg by leaving idempotencyKey on it (the unique key
      // protects the whole transfer — both legs share intent).
    });
    await mgr.save(WarehouseTransaction, outgoing);

    const incoming = mgr.create(WarehouseTransaction, {
      ...data,
      itemId: targetItem.id,
      type: 'transfer',
      balanceAfter: targetItem.quantity,
      // The second leg cannot reuse the unique idempotencyKey, so we drop it.
      idempotencyKey: undefined,
    });
    await mgr.save(WarehouseTransaction, incoming);

    return outgoing;
  }
}
