import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { WarehouseItem } from '../../warehouse/entities/warehouse-item.entity';
import { Stocktake } from './stocktake.entity';

/**
 * One line per item being counted. `expected` is captured at line creation
 * (the system's belief at that moment); `actual` is what the counter saw on
 * the shelf. variance = actual - expected; reasons (porcha/krazha/error)
 * help triage when approving.
 */
@Entity('stocktake_lines')
@Index(['stocktakeId', 'itemId'], { unique: true })
export class StocktakeLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stocktakeId: string;

  @ManyToOne(() => Stocktake, (s) => s.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stocktakeId' })
  stocktake: Stocktake;

  @Column()
  itemId: string;

  @ManyToOne(() => WarehouseItem)
  @JoinColumn({ name: 'itemId' })
  item: WarehouseItem;

  @Column({ length: 200 })
  itemName: string;

  @Column({ length: 20 })
  unit: string;

  @Column('decimal', { precision: 10, scale: 2 })
  expected: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  actual: number;

  // Cached actual - expected, kept in DB so reports don't have to compute.
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  variance: number;

  @Column({ length: 30, nullable: true })
  // 'spoilage' | 'theft' | 'count_error' | 'damage' | 'other'
  varianceReason: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
