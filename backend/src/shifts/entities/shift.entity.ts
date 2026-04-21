import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ShiftStatus = 'open' | 'closed' | 'reconciled';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', nullable: true })
  outletId: string | null;

  @Column({ type: 'timestamp' })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  openingCash: number;

  /** Calculated at close: openingCash + sum(cash transactions) - sum(cash refunds) */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  expectedCash: number | null;

  /** Counted by cashier (blind count) */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  actualCash: number | null;

  /** actualCash - expectedCash; positive = surplus, negative = shortage */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  variance: number | null;

  @Column({ length: 20, default: 'open' })
  status: ShiftStatus;

  /** UserId of manager who approved a non-zero variance close */
  @Column({ type: 'varchar', nullable: true })
  closeApprovedBy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
