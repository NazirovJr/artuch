import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
@Index(['station', 'status'])
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

  // Routing: where this line item is prepared. Copied from MenuItem.station at
  // order time (the menu config can change later). 'none' = no prep, the waiter
  // brings it directly (bread, water, bottled drinks) — never hits the KDS.
  @Column({ length: 20, default: 'kitchen' })
  station: string; // 'kitchen' | 'bar' | 'none'

  // Per-item lifecycle, independent of sibling items in the same round:
  // new → sent → preparing → ready → served (or → cancelled).
  // 'none' items are created already 'served'.
  @Column({ length: 20, default: 'new' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  firedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readyAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  servedAt: Date;

  @Column({ type: 'text', nullable: true })
  voidReason: string;

  @Column({ nullable: true })
  voidedBy: string;
}
