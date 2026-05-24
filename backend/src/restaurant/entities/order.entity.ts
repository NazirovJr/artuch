import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderItem } from './order-item.entity';
import { RestaurantCheck } from './restaurant-check.entity';

@Entity('orders')
@Index(['checkId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  orderNumber: number;

  // Parent check (table session). Nullable for legacy rows seeded before the
  // check model existed — the seed backfills a 1:1 check for those. New rounds
  // always belong to a check.
  @Column({ nullable: true })
  checkId: string;

  @ManyToOne(() => RestaurantCheck, (c) => c.orders, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checkId' })
  check: RestaurantCheck;

  // 1st, 2nd, … round within the check.
  @Column({ type: 'int', default: 1 })
  roundNumber: number;

  @Column({ nullable: true })
  waiterId: string;

  @Column({ length: 100, nullable: true })
  waiterName: string;

  @Column({ length: 20 })
  tableNumber: string;

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
