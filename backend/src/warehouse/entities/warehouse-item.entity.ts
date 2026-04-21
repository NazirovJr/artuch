import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('warehouse_items')
export class WarehouseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 20 })
  category: string;

  @Column({ length: 20 })
  unit: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minQuantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  warehouseId: string;

  @UpdateDateColumn()
  lastUpdated: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
