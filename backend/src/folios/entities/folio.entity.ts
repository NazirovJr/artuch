import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FolioCharge } from './folio-charge.entity';

@Entity('folios')
export class Folio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  guestId: string;

  @Column({ nullable: true })
  reservationId: string;

  @Column({ type: 'int', nullable: true })
  roomNumber: number;

  @Column({ length: 20, default: 'open' })
  status: string; // 'open' | 'closed'

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => FolioCharge, (charge) => charge.folio, {
    cascade: true,
    eager: false,
  })
  charges: FolioCharge[];

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
