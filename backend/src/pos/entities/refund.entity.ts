import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
