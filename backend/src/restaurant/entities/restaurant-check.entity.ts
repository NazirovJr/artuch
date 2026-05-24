import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Order } from './order.entity';

/**
 * A table check (счёт) — the consolidated, long-lived bill for one table /
 * guest session. Opened when the first round is sent, it accumulates many
 * `Order` rounds (KOTs) over the visit and is settled once at the end.
 *
 * This is what makes "guest ordered, then ordered again" show up as a single
 * bill: each new round links to the same open check via Order.checkId, and the
 * check's totals are the sum across all its rounds.
 *
 * Lifecycle: open → closed (settled) | cancelled.
 */
@Entity('restaurant_checks')
@Index(['status'])
@Index(['tableNumber', 'status'])
export class RestaurantCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  checkNumber: number;

  @Column({ length: 20 })
  tableNumber: string;

  @Column({ length: 20, default: 'open' })
  status: string; // 'open' | 'closed' | 'cancelled'

  // Optional link to a hotel guest — set when the check is billed to a room.
  @Column({ nullable: true })
  guestId: string;

  // Set on settlement when paymentMethod = 'folio'.
  @Column({ nullable: true })
  folioId: string;

  @Column({ nullable: true })
  openedBy: string;

  @Column({ length: 100, nullable: true })
  openedByName: string;

  @Column({ type: 'int', default: 1 })
  guestCount: number;

  // Running money, recomputed from line items by ChecksService.recalcTotals().
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountTotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  // Settlement.
  @Column({ length: 20, nullable: true })
  paymentMethod: string; // 'cash' | 'card' | 'folio'

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ nullable: true })
  settledBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => Order, (o) => o.check)
  orders: Order[];

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
