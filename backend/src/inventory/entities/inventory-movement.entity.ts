import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'itemId' })
  item: InventoryItem;

  @Column({ length: 200 })
  itemName: string;

  @Column({ length: 10 })
  type: string;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalCost: number;

  @Column()
  employeeId: string;

  @Column({ length: 200 })
  employee: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ length: 200, nullable: true })
  supplier: string;

  @CreateDateColumn()
  createdAt: Date;
}
