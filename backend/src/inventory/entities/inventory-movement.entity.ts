import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

export type InventoryMovementType =
  | 'income'
  | 'expense'
  | 'sale'
  | 'return' // legacy alias for return_customer
  | 'return_customer'
  | 'return_supplier'
  | 'adjustment'
  | 'writeoff';

@Entity('inventory_movements')
@Index(['itemId', 'createdAt'])
@Index(['type', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'itemId' })
  item: InventoryItem;

  @Column({ length: 200 })
  itemName: string;

  @Column({ length: 20 })
  type: InventoryMovementType;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalCost: number;

  // Stock value AFTER applying this movement, for audit/replay purposes.
  @Column({ nullable: true })
  balanceAfter: number;

  @Column()
  employeeId: string;

  @Column({ length: 200 })
  employee: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ length: 200, nullable: true })
  supplier: string;

  // Client-supplied UUID for safe retries over flaky mobile networks.
  @Column({ type: 'uuid', nullable: true, unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
