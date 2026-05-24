import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('transaction_items')
export class TransactionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Transaction, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: string;

  // The inventory item this line was sold from. Nullable for legacy rows and
  // for non-stock lines (services / ad-hoc items). Preferred over `name` for
  // stock deduction and refund restock — names are not a stable key.
  @Column({ nullable: true })
  itemId: string;

  @Column({ length: 200 })
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  volume: number;
}
