import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WarehouseItem } from './warehouse-item.entity';

@Entity('warehouse_transactions')
export class WarehouseTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  transactionNumber: number;

  @Column({ length: 10 })
  type: string;

  @Column()
  itemId: string;

  @ManyToOne(() => WarehouseItem, { eager: true })
  @JoinColumn({ name: 'itemId' })
  item: WarehouseItem;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column()
  performedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ length: 200, nullable: true })
  supplier: string;

  @Column({ length: 200, nullable: true })
  recipient: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalCost: number;

  @Column({ nullable: true })
  sourceWarehouseId: string;

  @Column({ nullable: true })
  targetWarehouseId: string;

  @CreateDateColumn()
  createdAt: Date;
}
