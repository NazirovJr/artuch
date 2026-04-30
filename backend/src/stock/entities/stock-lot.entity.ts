import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import type { LocationKind, StockSource } from './stock-level.entity';

/**
 * One physical batch of stock — what arrived together from one supplier
 * receipt. Tracks expiration and the cost basis at the time of receipt.
 *
 * Lots are *optional*: items that don't expire (snowshoes, climbing rope)
 * don't need them. When at least one lot exists for an (item, location),
 * issues prefer FEFO selection (earliest expiration first); otherwise
 * we fall back to plain StockLevel decrement.
 *
 * Invariant when lots are used:
 *   stock_levels.quantity == sum(stock_lots.remainingQuantity) for the same
 *                            (source, itemId, locationId).
 */
@Entity('stock_lots')
@Index(['source', 'itemId', 'locationId', 'expiresAt'])
@Index(['expiresAt']) // for "expiring soon" reports
@Index(['lotCode'])
export class StockLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  // Supplier-supplied batch identifier (e.g. on the box label). Optional
  // when the receiver doesn't track it; the lot is still distinct by id.
  @Column({ length: 100, nullable: true })
  lotCode: string;

  @Column({ type: 'timestamptz' })
  receivedAt: Date;

  // Null = non-perishable (e.g. equipment, climbing gear).
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column('decimal', { precision: 12, scale: 3 })
  originalQuantity: number;

  @Column('decimal', { precision: 12, scale: 3 })
  remainingQuantity: number;

  // Cost per unit at receipt — used for FIFO COGS calculation.
  @Column('decimal', { precision: 12, scale: 4, nullable: true })
  unitCost: number;

  // Denormalized snapshot of the supplier's display name at receipt time.
  // The FK below is the canonical reference; the string survives even if
  // a supplier is renamed or deactivated, so audits stay readable.
  @Column({ length: 200, nullable: true })
  supplierName: string;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Pointer back to the receipt movement that created this lot.
  @Column({ nullable: true })
  receivedMovementId: string;

  @Column({ default: true })
  isActive: boolean; // false when remainingQuantity drops to 0

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
