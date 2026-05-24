import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AlertsService } from '../alerts/alerts.service';
import { mirrorIdempotencyKey } from '../common/deterministic-uuid';
import { StockMovementType } from '../stock/entities/stock-movement.entity';
import { StockService } from '../stock/stock.service';
import { InventoryItem } from './entities/inventory-item.entity';
import {
  InventoryMovement,
  InventoryMovementType,
} from './entities/inventory-movement.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';

const INVENTORY_TYPE_TO_STOCK: Record<
  InventoryMovementType,
  StockMovementType
> = {
  income: 'receipt',
  expense: 'issue',
  sale: 'sale',
  return: 'return_customer', // legacy alias
  return_customer: 'return_customer',
  return_supplier: 'return_supplier',
  adjustment: 'adjustment',
  writeoff: 'writeoff',
};

// Sentinel for inventory items that aren't tied to a physical warehouse
// (POS-only items). All POS movements without a warehouseId share this
// virtual location so they're still queryable in the unified ledger.
const POS_DEFAULT_LOCATION = '__pos_default__';

const INCREMENT_TYPES: ReadonlySet<InventoryMovementType> = new Set([
  'income',
  'return',
  'return_customer',
]);

const DECREMENT_TYPES: ReadonlySet<InventoryMovementType> = new Set([
  'expense',
  'sale',
  'writeoff',
  'return_supplier',
]);

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private itemsRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private movementsRepo: Repository<InventoryMovement>,
    @InjectRepository(WarehouseItem)
    private warehouseItemsRepo: Repository<WarehouseItem>,
    @InjectDataSource() private dataSource: DataSource,
    private alertsService: AlertsService,
    private stockService: StockService,
  ) {}

  /**
   * Mirror an inventory movement into the unified StockLevel/StockMovement
   * tables (dual-write). Same DB transaction as the legacy write.
   */
  private async mirrorToUnified(
    mgr: EntityManager,
    item: InventoryItem,
    data: Partial<InventoryMovement>,
    type: InventoryMovementType,
  ): Promise<void> {
    const stockType = INVENTORY_TYPE_TO_STOCK[type];
    if (!stockType) return;

    // Adjustment is an absolute SET in the legacy table (item.stock = qty), so
    // the unified side must SET to the same absolute too — not add it as a
    // delta (which is what apply('adjustment') would do). Route through
    // setExact, which records the variance as an 'adjustment' movement.
    if (stockType === 'adjustment') {
      await this.stockService.setExact(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          newQuantity: Number(data.quantity!),
          performedBy: data.employeeId!,
          performedByName: data.employee,
          notes: data.note,
          movementType: 'adjustment',
          idempotencyKey: mirrorIdempotencyKey(data.idempotencyKey, 'inv-mirror'),
        },
        mgr,
      );
      return;
    }

    await this.stockService.apply(
      {
        source: 'inventory',
        itemId: item.id,
        itemName: item.name,
        locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
        locationKind: item.warehouseId ? 'warehouse' : 'outlet',
        type: stockType,
        quantity: Number(data.quantity!),
        performedBy: data.employeeId!,
        performedByName: data.employee,
        notes: data.note,
        counterparty: data.supplier,
        unitCost: data.price ? Number(data.price) : undefined,
        totalCost: data.totalCost ? Number(data.totalCost) : undefined,
        idempotencyKey: mirrorIdempotencyKey(data.idempotencyKey, 'inv-mirror'),
      },
      mgr,
    );
  }

  private async maybeAlert(
    mgr: EntityManager,
    item: InventoryItem,
  ): Promise<void> {
    const reorderPoint =
      Number(item.reorderPoint) > 0
        ? Number(item.reorderPoint)
        : Number(item.minStock);
    await this.alertsService.checkAndUpsert(mgr, {
      source: 'inventory',
      itemId: item.id,
      itemName: item.name,
      warehouseId: item.warehouseId,
      currentLevel: Number(item.stock),
      reorderPoint,
      parLevel: Number(item.parLevel),
    });
  }

  async findAllItems(category?: string): Promise<InventoryItem[]> {
    const where: any = { isActive: true };
    if (category) where.category = category;
    return this.itemsRepo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async findItemById(id: string): Promise<InventoryItem> {
    const item = await this.itemsRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  /** Lookup by exact name (no lock). Returns null when absent. Used by POS to
   *  resolve a cart line's name → stable itemId before persisting. */
  findItemByName(name: string): Promise<InventoryItem | null> {
    return this.itemsRepo.findOne({ where: { name } });
  }

  async createItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = this.itemsRepo.create(data);
    return this.itemsRepo.save(item);
  }

  async updateItem(
    id: string,
    data: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    const item = await this.findItemById(id);
    Object.assign(item, data);
    return this.itemsRepo.save(item);
  }

  async findAllMovements(): Promise<InventoryMovement[]> {
    return this.movementsRepo.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * For draft/weighed items (unit='ml'|'g') stock is in raw units, but sales
   * come in "servings" (e.g. one pour). Convert servings → raw using the
   * item's mlPerServing so theoretical stock matches reality and shrinkage
   * reports can be trusted. Income is always in raw units already.
   */
  private toStockUnits(item: InventoryItem, quantity: number): number {
    if ((item.unit === 'ml' || item.unit === 'g') && item.mlPerServing) {
      return quantity * Number(item.mlPerServing);
    }
    return quantity;
  }

  /**
   * Apply a stock movement atomically: lock the item row, mutate stock,
   * insert the ledger entry — all in one DB transaction. Idempotent on
   * idempotencyKey; rejects movements that would drive stock below zero.
   */
  async addMovement(
    data: Partial<InventoryMovement>,
  ): Promise<InventoryMovement> {
    return this.dataSource.transaction(async (mgr) => {
      if (data.idempotencyKey) {
        const existing = await mgr.findOne(InventoryMovement, {
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return existing;
      }

      const item = await mgr.findOne(InventoryItem, {
        where: { id: data.itemId! },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Item not found');

      const type = data.type as InventoryMovementType;
      const qty = data.quantity!;

      if (INCREMENT_TYPES.has(type)) {
        // Income arrives in raw units (whole bottle/pack), no conversion.
        item.stock += qty;
        if (type === 'income' && data.price) item.purchasePrice = data.price;
      } else if (DECREMENT_TYPES.has(type)) {
        const decrementBy = this.toStockUnits(item, qty);
        if (item.stock - decrementBy < 0) {
          throw new BadRequestException(
            `Insufficient stock for "${item.name}": have ${item.stock} ${item.unit}, need ${decrementBy}`,
          );
        }
        item.stock -= decrementBy;
        if (type === 'sale') item.soldCount += qty;
      } else if (type === 'adjustment') {
        item.stock = qty;
      } else {
        throw new BadRequestException(`Unsupported movement type: ${type}`);
      }

      await mgr.save(InventoryItem, item);
      await this.maybeAlert(mgr, item);
      await this.mirrorToUnified(mgr, item, data, type);

      const movement = mgr.create(InventoryMovement, {
        ...data,
        itemName: data.itemName ?? item.name,
        balanceAfter: item.stock,
      });
      return mgr.save(InventoryMovement, movement);
    });
  }

  /**
   * Helper used by POS code paths that decrement stock on order completion.
   * Goes through the same locked path as addMovement but without writing a
   * ledger entry — the caller is responsible for writing its own movement.
   */
  async decrementStock(
    itemName: string,
    quantity: number,
    itemId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      // Prefer the stable id when the caller has it; fall back to name for
      // legacy callers / lines without a resolved id.
      const item = await mgr.findOne(InventoryItem, {
        where: itemId ? { id: itemId } : { name: itemName },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) return;
      const decrementBy = this.toStockUnits(item, quantity);
      if (item.stock - decrementBy < 0) {
        throw new BadRequestException(
          `Insufficient stock for "${item.name}": have ${item.stock}, need ${decrementBy}`,
        );
      }
      item.stock -= decrementBy;
      item.soldCount += quantity;
      await mgr.save(InventoryItem, item);
      await this.maybeAlert(mgr, item);

      // Mirror as a 'sale' in the unified ledger. POS callers that already
      // write their own ledger entry (transactions module) can skip this
      // — but having it here means even legacy paths populate the unified
      // history.
      await this.stockService.apply(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          type: 'sale',
          quantity,
          performedBy: 'system:pos-decrement',
          notes: 'pos auto-decrement',
        },
        mgr,
      );
    });
  }

  /**
   * Inverse of {@link decrementStock}: put goods back on the shelf when a POS
   * sale is refunded. Symmetric to the decrement path — locks by name, adds
   * the same converted quantity back, walks soldCount down, and mirrors a
   * `return_customer` movement into the unified ledger. Idempotent on the
   * caller-supplied key so a retried refund won't double-restock. Unknown
   * item names (services / non-stock lines) are skipped silently.
   */
  async restockStock(
    itemName: string,
    quantity: number,
    idempotencyKey?: string,
    itemId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const item = await mgr.findOne(InventoryItem, {
        where: itemId ? { id: itemId } : { name: itemName },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) return;
      const addBy = this.toStockUnits(item, quantity);
      item.stock += addBy;
      // Keep net-sold accurate without underflowing.
      item.soldCount = Math.max(0, Number(item.soldCount) - quantity);
      await mgr.save(InventoryItem, item);
      await this.maybeAlert(mgr, item);

      await this.stockService.apply(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          type: 'return_customer',
          quantity,
          performedBy: 'system:pos-refund',
          notes: 'pos refund restock',
          idempotencyKey,
        },
        mgr,
      );
    });
  }

  /**
   * Transfers stock from the physical warehouse to the bar/outlet counter.
   * Atomically:
   *   1. Validates the inventory item has a warehouseItemId and the warehouse
   *      holds sufficient stock.
   *   2. Decrements warehouse_items.quantity + creates a WarehouseTransaction
   *      (type 'expense') so the withdrawal appears in the warehouse journal.
   *   3. Increments inventory_items.stock + creates an InventoryMovement
   *      (type 'income') so the receipt appears in the bar stock history.
   *   4. Mirrors both sides to the unified stock ledger via StockService.
   */
  async receiveFromWarehouse(
    itemId: string,
    quantity: number,
    actor: { id: string; name?: string },
  ): Promise<InventoryItem> {
    return this.dataSource.transaction(async (mgr) => {
      const item = await mgr.findOne(InventoryItem, {
        where: { id: itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (!item.warehouseItemId)
        throw new ConflictException('This item is not linked to a warehouse SKU');

      const wItem = await mgr.findOne(WarehouseItem, {
        where: { id: item.warehouseItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wItem) throw new NotFoundException('Linked warehouse item not found');

      if (Number(wItem.quantity) < quantity) {
        throw new BadRequestException(
          `Insufficient warehouse stock: have ${wItem.quantity} ${wItem.unit}, need ${quantity}`,
        );
      }

      // Warehouse side: debit
      const addBy = this.toStockUnits(item, quantity);
      wItem.quantity = Number(wItem.quantity) - quantity;
      await mgr.save(WarehouseItem, wItem);

      // Unified ledger: warehouse issue
      await this.stockService.apply(
        {
          source: 'warehouse',
          itemId: wItem.id,
          itemName: wItem.name,
          locationId: wItem.warehouseId ?? '__no_warehouse__',
          locationKind: 'warehouse',
          type: 'issue',
          quantity,
          performedBy: actor.id,
          performedByName: actor.name,
          notes: `Отпущено в бар → ${item.name}`,
        },
        mgr,
      );

      // Bar/inventory side: credit
      item.stock += addBy;
      await mgr.save(InventoryItem, item);
      await this.maybeAlert(mgr, item);

      // Unified ledger: inventory receipt
      await this.stockService.apply(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          type: 'receipt',
          quantity: addBy,
          performedBy: actor.id,
          performedByName: actor.name,
          notes: `Получено со склада`,
        },
        mgr,
      );

      return item;
    });
  }
}
