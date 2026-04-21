import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TransactionItem } from './transaction-item.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10 })
  type: string;

  @Column({ nullable: true })
  employeeId: string;

  @Column({ length: 100, nullable: true })
  employee: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({ length: 10, nullable: true })
  tableNumber: string;

  @Column({ length: 20, default: 'cash' })
  paymentMethod: string;

  @Column({ nullable: true })
  outletId: string;

  @Column({ nullable: true })
  folioId: string;

  @Column({ nullable: true })
  shiftId: string;

  @Column({ length: 20, default: 'completed' })
  status: string; // 'completed' | 'refunded' | 'partially-refunded'

  @OneToMany(() => TransactionItem, (item) => item.transaction, { cascade: true, eager: true })
  items: TransactionItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
