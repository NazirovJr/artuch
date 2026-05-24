import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A recorded money inflow that is NOT captured by POS / hotel / rentals —
 * "прочие доходы" (e.g. an event fee, a sublease payment, sale of an old
 * asset, a grant). Append-friendly: corrections are made by voiding
 * (status='void') + recording a new one, never hard-deleting — keeps the
 * income register auditable. `receivedAt` is the business date the money
 * arrived; `createdAt` is when it was entered. Mirrors {@link Expense}.
 */
@Entity('incomes')
@Index(['receivedAt'])
@Index(['categoryId'])
@Index(['status'])
export class Income {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  incomeNumber: number;

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
  receivedAt: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Who paid / the source of the money (mirror of expense.vendor).
  @Column({ length: 200, nullable: true })
  payer: string;

  @Column({ nullable: true })
  outletId: string;

  @Column({ nullable: true })
  recordedBy: string;

  @Column({ length: 100, nullable: true })
  recordedByName: string;

  // Set when cash is received into an open till — feeds shift variance.
  @Column({ nullable: true })
  shiftId: string;

  @Column({ length: 20, default: 'recorded' })
  status: string; // recorded | void

  @Column({ type: 'text', nullable: true })
  voidReason: string;

  @Column({ nullable: true })
  voidedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
