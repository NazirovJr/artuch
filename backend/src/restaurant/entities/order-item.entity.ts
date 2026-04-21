import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @Column()
  menuItemId: string;

  @Column({ length: 200 })
  menuItemName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  menuItemPrice: number;

  @Column()
  quantity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
