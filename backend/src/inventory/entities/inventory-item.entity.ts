import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  purchasePrice: number;

  @Column({ length: 20 })
  category: string;

  @Column({ length: 50, nullable: true })
  barcode: string;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 0 })
  minStock: number;

  @Column({ length: 20 })
  unit: string;

  @Column({ default: 0 })
  soldCount: number;

  @Column({ default: false })
  isDraft: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  pricePerLiter: number;

  // For weight/volume items (unit='ml' or 'g') stock is held in raw ml/g.
  // Each "serving" in an order represents this many units, so a draft pour of
  // 1 (serving) decrements the stock by mlPerServing instead of 1 — keeping
  // theoretical vs actual stock honest for shrinkage reports.
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  mlPerServing: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  warehouseId: string;

  @Column({ default: false })
  isRentable: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  rentalPricePerDay: number;

  @Column({ default: 0 })
  rentedQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
