import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Client-supplied dedup key. A retried refund (network double-send or a
  // double-tap) reuses the same key, so the unique index lets the service
  // return the existing refund instead of creating a second one. Nullable
  // for backward-compat with historical rows / callers without a key.
  @Column({ type: 'varchar', nullable: true, unique: true })
  @Index()
  idempotencyKey: string | null;

  @Column()
  transactionId: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column({ type: 'jsonb' })
  items: Array<{ name: string; price: number; quantity: number }>;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 255 })
  reason: string;

  @Column()
  employeeId: string;

  @Column({ length: 100 })
  employeeName: string;

  @Column({ nullable: true })
  folioId: string;

  @Column({ nullable: true })
  shiftId: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ length: 100, nullable: true })
  approvalReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
