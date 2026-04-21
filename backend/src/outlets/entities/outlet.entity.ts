import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('outlets')
export class Outlet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  type: string; // 'shop' | 'bar' | 'restaurant' | 'rental'

  @Column({ nullable: true })
  warehouseId: string; // FK to warehouses (will be linked later)

  @Column({ default: false })
  supportsFolio: boolean;

  @Column({ default: false })
  supportsRental: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
