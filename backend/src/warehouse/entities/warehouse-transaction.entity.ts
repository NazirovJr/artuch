import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WarehouseItem } from './warehouse-item.entity';

export type WarehouseTransactionType =
  | 'income'
  | 'expense'
  | 'sale'
  | 'transfer'
  | 'return' // legacy alias for return_customer
  | 'return_customer'
  | 'return_supplier'
  | 'adjustment'
  | 'writeoff';

@Entity('warehouse_transactions')
@Index(['itemId', 'createdAt'])
@Index(['type', 'createdAt'])
export class WarehouseTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  transactionNumber: number;

  @Column({ length: 20 })
  type: WarehouseTransactionType;

  @Column()
  itemId: string;

  @ManyToOne(() => WarehouseItem, { eager: true })
  @JoinColumn({ name: 'itemId' })
  item: WarehouseItem;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  // Stock value AFTER applying this movement — gives a point-in-time
  // snapshot for audit and for rebuilding state without replaying the ledger.
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  balanceAfter: number;

  @Column()
  performedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Free-text supplier name (legacy + denormalized snapshot for reports
  // that don't JOIN). New code should also fill `supplierId` so we can
  // aggregate properly.
  @Column({ length: 200, nullable: true })
  supplier: string;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ length: 200, nullable: true })
  recipient: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalCost: number;

  @Column({ nullable: true })
  sourceWarehouseId: string;

  @Column({ nullable: true })
  targetWarehouseId: string;

  // Client-supplied UUID for safe retries over flaky mobile networks.
  // Unique-when-present so duplicate POSTs return the original record.
  @Column({ type: 'uuid', nullable: true, unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
