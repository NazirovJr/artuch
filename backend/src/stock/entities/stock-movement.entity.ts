import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { LocationKind, StockSource } from './stock-level.entity';

export type StockMovementType =
  | 'receipt'         // incoming from supplier
  | 'issue'           // outgoing to customer / staff use (non-sale)
  | 'sale'            // POS sale
  | 'transfer_out'    // leg 1 of inter-location move
  | 'transfer_in'     // leg 2 of inter-location move
  | 'return_customer' // customer return (stock back +)
  | 'return_supplier' // return to supplier (stock −)
  | 'adjustment'      // free-form correction (+ or −)
  | 'stocktake'       // variance correction from a counted stocktake
  | 'rental_out'      // unit goes out on rental — reservedQuantity bumps
  | 'rental_in'       // unit returned from rental — reservedQuantity drops
  | 'writeoff';       // damage / spoilage / shrinkage

/**
 * Unified, immutable, append-only ledger for ALL stock changes. Replaces
 * warehouse_transactions and inventory_movements semantically. The legacy
 * tables stay populated by their respective services (dual-write) until
 * downstream consumers migrate.
 *
 * Querying this single table gives a complete audit history per item,
 * per location, regardless of whether the move came from POS, the
 * warehouse module, a transfer, a rental, or a stocktake.
 */
@Entity('stock_movements')
@Index(['source', 'itemId', 'createdAt'])
@Index(['locationId', 'createdAt'])
@Index(['type', 'createdAt'])
@Index(['referenceType', 'referenceId'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Auto-incrementing sequence number per insert — handy for ordering and
  // for human-readable references ("movement #4837").
  @Column({ type: 'int', generated: 'increment' })
  movementNumber: number;

  @Column({ length: 20 })
  source: StockSource;

  @Column()
  itemId: string;

  @Column({ length: 200 })
  itemName: string;

  @Column()
  locationId: string;

  @Column({ length: 20 })
  locationKind: LocationKind;

  @Column({ length: 20 })
  type: StockMovementType;

  // Always positive. The `type` encodes direction.
  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { precision: 12, scale: 3 })
  balanceAfter: number;

  @Column('decimal', { precision: 12, scale: 3, nullable: true })
  reservedAfter: number;

  @Column()
  performedBy: string;

  @Column({ length: 200, nullable: true })
  performedByName: string;

  // Optional pointer to the originating domain object. (Polymorphic; not a
  // hard FK — too many possible targets.) Examples: 'StockTransfer',
  // 'Rental', 'Order', 'Stocktake', 'PurchaseOrder'.
  @Column({ length: 30, nullable: true })
  referenceType: string;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ length: 200, nullable: true })
  counterparty: string; // supplier name, customer, staff member, etc.

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  unitCost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  totalCost: number;

  // For lot-tracked items: the StockLot that this movement created
  // (on receipts) or consumed from (on issues). When an issue spans
  // multiple lots, we emit one StockMovement per lot so the audit
  // history stays granular.
  @Column({ nullable: true })
  lotId: string;

  @Column({ length: 100, nullable: true })
  lotCode: string;

  @Column({ type: 'uuid', nullable: true, unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
