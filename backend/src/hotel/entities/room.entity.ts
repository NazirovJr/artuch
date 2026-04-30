import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomType } from './room-type.entity';

/**
 * Physical hotel room. Most of the marketing/spec data lives on the
 * referenced RoomType; this row just identifies the instance and tracks
 * its operational state (status, current reservation, cleaning).
 *
 * Why `number` is still the primary key: too much existing code (URL
 * routes, currentReservationId callers, foreign-table joins like
 * folios.roomNumber, reservations.roomNumber) reaches for it directly.
 * Migrating those to a UUID would be a multi-PR refactor; we keep the
 * int PK and add roomTypeId as a regular FK.
 */
@Entity('rooms')
@Index(['roomTypeId'])
export class Room {
  @PrimaryColumn()
  number: number;

  // Legacy string type label, still populated for backwards compatibility
  // with reports and v1 endpoints that haven't migrated to roomTypeId.
  // New code should JOIN on roomType.
  @Column({ length: 20 })
  type: string;

  @Column({ nullable: true })
  roomTypeId: string;

  @ManyToOne(() => RoomType, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;

  // Physical attributes that vary per-room even within one type:
  // floor / wing / specific notes ("corner unit, has extra window").
  @Column({ nullable: true })
  floor: number;

  @Column({ length: 100, nullable: true })
  location: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ─── Spec fallbacks (kept for v1 compat) ─────────────────────
  // These mirror RoomType.* and are written when a Room is created
  // without a roomTypeId, so the older grid still has data to render.
  @Column()
  beds: number;

  @Column()
  maxGuests: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerNight: number;

  // ─── Operational state ───────────────────────────────────────
  @Column({ length: 20, default: 'available' })
  status: string;

  @Column({ length: 20, default: 'clean' })
  cleaningStatus: string;

  @Column({ nullable: true })
  currentReservationId: string;

  @Column({ default: true })
  isActive: boolean;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
