import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { StockSource } from './stock-level.entity';

/**
 * Per-item unit aliases. The item's canonical unit lives on the item row
 * itself (e.g. WarehouseItem.unit = "ml"). This table records that, for
 * THIS specific item, "1 bottle = 750 ml" and "1 case = 4500 ml". Receipts
 * coming in "cases" get multiplied by 4500 before they hit the ledger;
 * issues coming in "shots" get multiplied by 30, etc.
 *
 * Why per-item rather than global: the bar's vodka bottle is 750ml but the
 * cleaning supply's "bottle" is 1000ml. Globalising leaks the wrong
 * conversion to the wrong SKU.
 */
@Entity('unit_conversions')
@Unique(['source', 'itemId', 'fromUnit'])
@Index(['itemId'])
export class UnitConversion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  source: StockSource;

  @Column()
  itemId: string;

  // The "input" unit, e.g. 'case', 'box', 'bottle', 'shot'.
  @Column({ length: 20 })
  fromUnit: string;

  // How many canonical units one fromUnit yields. Float for cases like
  // "1 portion = 0.15 kg" (factor=0.15 with canonical=kg). Always positive.
  @Column('decimal', { precision: 12, scale: 4 })
  factor: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
