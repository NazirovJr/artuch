import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('rentals')
export class Rental {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @Column({ length: 150, nullable: true })
  itemName: string;

  @Column({ nullable: true })
  guestId: string;

  @Column({ nullable: true })
  folioId: string;

  @Column({ nullable: true })
  outletId: string;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerDay: number;

  @Column()
  issuedBy: string;

  @Column({ length: 100, nullable: true })
  issuedByName: string;

  @Column({ nullable: true })
  returnedBy: string;

  @Column({ length: 100, nullable: true })
  returnedByName: string;

  @CreateDateColumn()
  issuedAt: Date;

  @Column({ type: 'date' })
  expectedReturn: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualReturn: Date;

  @Column({ length: 20, default: 'active' })
  status: string; // active | returned | overdue | damaged

  @Column({ type: 'text', nullable: true })
  damageNote: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  damageFee: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalCharge: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
