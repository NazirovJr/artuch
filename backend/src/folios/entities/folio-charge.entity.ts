import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Folio } from './folio.entity';

@Entity('folio_charges')
export class FolioCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  folioId: string;

  @ManyToOne(() => Folio, (folio) => folio.charges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folioId' })
  folio: Folio;

  @Column({ length: 30 })
  chargeType: string; // room | restaurant | bar | shop | rental | service | discount | refund | payment

  @Column({ nullable: true })
  sourceId: string;

  @Column({ length: 255 })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number; // negative for discounts/refunds/payments

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  quantity: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  unitPrice: number | null;

  @Column({ nullable: true })
  addedBy: string; // userId

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ length: 100, nullable: true })
  approvalReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
