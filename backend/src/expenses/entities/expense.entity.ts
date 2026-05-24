import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A recorded money outflow (затрата). Append-friendly: corrections are made by
 * voiding (status='void') + recording a new one, never hard-deleting — keeps
 * the expense register auditable. `spentAt` is the business date the money
 * left; `createdAt` is when it was entered.
 */
@Entity('expenses')
@Index(['spentAt'])
@Index(['categoryId'])
@Index(['status'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  expenseNumber: number;

  @Column()
  categoryId: string;

  // Denormalized so a renamed/removed category doesn't rewrite history.
  @Column({ length: 120 })
  categoryName: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 20, default: 'cash' })
  paymentMethod: string; // cash | card | bank | other

  @Column({ type: 'date' })
  spentAt: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ length: 200, nullable: true })
  vendor: string;

  @Column({ nullable: true })
  outletId: string;

  @Column({ nullable: true })
  recordedBy: string;

  @Column({ length: 100, nullable: true })
  recordedByName: string;

  // Set when a cash expense is paid out of an open till — feeds shift variance.
  @Column({ nullable: true })
  shiftId: string;

  @Column({ length: 20, default: 'recorded' })
  status: string; // recorded | void

  @Column({ type: 'text', nullable: true })
  voidReason: string;

  @Column({ nullable: true })
  voidedBy: string;

  // Manager who approved a large (over-threshold) expense via PIN.
  @Column({ nullable: true })
  approvedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
