import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export type AlertSeverity = 'warning' | 'critical';
export type AlertSource = 'warehouse' | 'inventory';

/**
 * One open alert per (source, itemId) pair — a second decrement that breaches
 * the same threshold should NOT spam new rows. The unique constraint on
 * (source, itemId, acknowledgedAt IS NULL) is enforced at app level via
 * upsert: if open alert exists, update currentLevel; otherwise insert.
 */
@Entity('low_stock_alerts')
@Index(['acknowledgedAt', 'createdAt'])
@Index(['itemId', 'source'])
export class LowStockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  source: AlertSource;

  @Column()
  itemId: string;

  @Column({ length: 200 })
  itemName: string;

  @Column({ nullable: true })
  warehouseId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  currentLevel: number;

  @Column('decimal', { precision: 10, scale: 2 })
  threshold: number;

  @Column({ length: 20 })
  severity: AlertSeverity;

  @Column({ nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
