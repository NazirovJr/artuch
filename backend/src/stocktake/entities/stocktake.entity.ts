import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { StocktakeLine } from './stocktake-line.entity';

export type StocktakeStatus =
  | 'in_progress'
  | 'awaiting_approval'
  | 'approved'
  | 'cancelled';

/**
 * A cycle-count session: a snapshot of expected vs actual counts for some
 * subset of a warehouse, plus the variance reconciliation. Approval
 * generates 'adjustment' or 'writeoff' ledger entries on the items so the
 * variance is reflected in the books with full audit (who counted, who
 * approved, why).
 */
@Entity('stocktakes')
@Index(['warehouseId', 'status', 'createdAt'])
export class Stocktake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ length: 20, default: 'in_progress' })
  status: StocktakeStatus;

  @Column({ length: 30, default: 'cycle' })
  // 'cycle' = a partial count of one category/zone; 'full' = whole warehouse.
  kind: 'cycle' | 'full';

  @Column({ length: 30, nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column()
  countedBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  cancelledBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @OneToMany(() => StocktakeLine, (line) => line.stocktake, {
    cascade: true,
  })
  lines: StocktakeLine[];
}
