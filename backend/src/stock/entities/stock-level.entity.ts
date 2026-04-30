import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export type StockSource = 'warehouse' | 'inventory';
export type LocationKind = 'warehouse' | 'outlet';

/**
 * The single source of truth for "how many units of item X are at location Y".
 *
 * Replaces the duplicate state previously held in:
 *   - warehouse_items.quantity (per-warehouse stock for warehouse module)
 *   - inventory_items.stock    (single global figure used by POS)
 *
 * Migration strategy: NEW operations write through StockService into this
 * table; legacy WarehouseItem.quantity and InventoryItem.stock are kept as
 * denormalized projections (dual-write) until POS / UI / staff-app callers
 * are ported to read from StockLevel directly. After that, drop the old
 * fields.
 *
 * Keys:
 *   - source:    which catalog the itemId belongs to.
 *                A warehouse SKU and an inventory SKU with the same name
 *                still get separate StockLevel rows — until catalog merge.
 *   - itemId:    UUID of the row in WarehouseItem or InventoryItem.
 *   - locationId: warehouse UUID or outlet UUID, depending on locationKind.
 *
 * One row per (source, itemId, locationId) — enforced by the unique index.
 */
@Entity('stock_levels')
@Unique(['source', 'itemId', 'locationId'])
@Index(['locationId', 'locationKind'])
@Index(['itemId'])
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  source: StockSource;

  @Column()
  itemId: string;

  @Column()
  locationId: string;

  @Column({ length: 20 })
  locationKind: LocationKind;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  quantity: number;

  // Soft-reservation: stock that's "owned" by a pending order, rental, or
  // transfer-in-flight. Available = quantity - reservedQuantity. Lets POS
  // hold stock for a tab without committing the sale.
  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  reservedQuantity: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
