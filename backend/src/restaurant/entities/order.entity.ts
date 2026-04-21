import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  orderNumber: number;

  @Column({ nullable: true })
  waiterId: string;

  @Column({ length: 100, nullable: true })
  waiterName: string;

  @Column()
  tableNumber: number;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ nullable: true })
  folioId: string;

  @Column({ length: 20, default: 'unpaid' })
  paymentStatus: string; // 'unpaid' | 'paid' | 'charged-to-folio'

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
