import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('warehouse_items')
@Index(['warehouseId', 'category', 'name'])
export class WarehouseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 20 })
  category: string;

  @Column({ length: 20 })
  unit: string;

  @Column({ length: 50, nullable: true })
  @Index()
  barcode: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minQuantity: number;

  // PAR (Periodic Automatic Replacement) — target stock the warehouse should
  // hold under normal demand. Reorder up to this level when ROP is breached.
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  parLevel: number;

  // Reorder point — threshold that triggers a low-stock alert. Typically
  // = (avg daily usage × lead time days) + safety stock. If 0, falls back
  // to minQuantity for legacy items.
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  reorderPoint: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @VersionColumn()
  version: number;

  @UpdateDateColumn()
  lastUpdated: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
