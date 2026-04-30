import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { WarehouseItem } from './warehouse-item.entity';

export type StockTransferStatus = 'in_transit' | 'received' | 'cancelled';

/**
 * Tracks stock that has left the source warehouse but has not yet been
 * accepted at the target. Two-step flow lets ops see what's "on the road"
 * (a real concern for the Fann Mountains route) and surfaces discrepancies
 * — a transfer marked received with quantity less than sent triggers an
 * investigation before the count is reconciled.
 *
 * Lifecycle: in_transit → received | cancelled
 * On creation:    source stock decremented, no target change yet.
 * On receive:     target stock incremented (by receivedQuantity).
 * On cancel:      source stock restored.
 */
@Entity('stock_transfers')
@Index(['status', 'createdAt'])
@Index(['sourceWarehouseId', 'status'])
@Index(['targetWarehouseId', 'status'])
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourceWarehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sourceWarehouseId' })
  sourceWarehouse: Warehouse;

  @Column()
  targetWarehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'targetWarehouseId' })
  targetWarehouse: Warehouse;

  // The source-warehouse item row that was decremented.
  @Column()
  sourceItemId: string;

  @ManyToOne(() => WarehouseItem)
  @JoinColumn({ name: 'sourceItemId' })
  sourceItem: WarehouseItem;

  // Set on receive — the target-warehouse row that got incremented.
  @Column({ nullable: true })
  targetItemId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  // Recorded on receive. Differs from `quantity` when the target acknowledges
  // a smaller count than was sent — the gap is the "in-transit loss".
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  receivedQuantity: number;

  @Column({ length: 20, default: 'in_transit' })
  status: StockTransferStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column()
  createdBy: string;

  @Column({ nullable: true })
  receivedBy: string;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ type: 'uuid', nullable: true, unique: true })
  idempotencyKey: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;
}
