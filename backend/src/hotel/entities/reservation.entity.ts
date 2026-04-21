import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Guest } from './guest.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  reservationNumber: number;

  @Column({ nullable: true })
  guestId: string;

  @ManyToOne(() => Guest, { nullable: true, eager: true })
  @JoinColumn({ name: 'guestId' })
  guest: Guest;

  @Column()
  roomNumber: number;

  @Column({ type: 'date' })
  checkInDate: string;

  @Column({ type: 'date' })
  checkOutDate: string;

  @Column({ default: 1 })
  numberOfGuests: number;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  folioId: string;

  @Column({ type: 'timestamptz', nullable: true })
  actualCheckIn: Date;

  @Column({ type: 'timestamptz', nullable: true })
  actualCheckOut: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
