import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryColumn()
  number: number;

  @Column({ length: 20 })
  type: string;

  @Column()
  beds: number;

  @Column()
  maxGuests: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerNight: number;

  @Column({ length: 20, default: 'available' })
  status: string;

  @Column({ length: 20, default: 'clean' })
  cleaningStatus: string;

  @Column({ nullable: true })
  currentReservationId: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
