import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Append-only audit trail of item-level edits to an Order. Every time someone
 * changes the line items of an existing order we snapshot what was there and
 * what it became, who did it, and (if the order had already entered cooking)
 * which manager approved it. Intentionally never updated or deleted.
 */
@Entity('order_edit_logs')
export class OrderEditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column({ length: 20 })
  orderStatusAtEdit: string;

  @Column({ type: 'jsonb' })
  oldItems: any;

  @Column({ type: 'jsonb' })
  newItems: any;

  @Column('decimal', { precision: 10, scale: 2 })
  oldTotal: number;

  @Column('decimal', { precision: 10, scale: 2 })
  newTotal: number;

  @Column()
  changedBy: string;

  @Column({ length: 100, nullable: true })
  changedByName: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ length: 100, nullable: true })
  approvalReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
