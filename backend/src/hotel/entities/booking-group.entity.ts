import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Folio } from '../../folios/entities/folio.entity';
import { Guest } from './guest.entity';
import { Reservation } from './reservation.entity';

export type BookingGroupStatus =
  | 'pending'   // group is being assembled
  | 'active'    // at least one reservation checked in
  | 'closed'    // master folio closed, no further charges
  | 'cancelled';

/**
 * Master record for a multi-room booking. Used when a tour party / family
 * / corporate trip occupies several rooms and wants ONE bill at the end.
 *
 * Architecturally it's a "block" in PMS terminology:
 *   - reservations[] — every room in the group references this group's id
 *   - masterFolio    — one Folio for the whole group; room-stay charges
 *                      from member reservations land here instead of on
 *                      per-room folios
 *
 * Per-guest incidentals (POS, restaurant) can still post to their own
 * personal folio if the group leader doesn't cover them, but the default
 * routing for all-inclusive groups is "everything to master".
 */
@Entity('booking_groups')
@Index(['code'], { unique: true })
@Index(['status', 'checkInDate'])
export class BookingGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stable short code displayed at reception ("G-2026-014") and used in
  // search. Auto-generated server-side if the admin doesn't supply one.
  @Column({ length: 30 })
  code: string;

  @Column({ length: 200 })
  name: string;

  // Group leader — usually the person who paid the deposit. Optional
  // because a corporate group might not have a single guest record.
  @Column({ nullable: true })
  leaderGuestId: string;

  @ManyToOne(() => Guest, { nullable: true })
  @JoinColumn({ name: 'leaderGuestId' })
  leaderGuest: Guest;

  @Column({ length: 200, nullable: true })
  contactName: string;

  @Column({ length: 50, nullable: true })
  contactPhone: string;

  @Column({ length: 100, nullable: true })
  contactEmail: string;

  @Column({ length: 200, nullable: true })
  organization: string;

  @Column({ type: 'date', nullable: true })
  checkInDate: string;

  @Column({ type: 'date', nullable: true })
  checkOutDate: string;

  @Column({ length: 20, default: 'pending' })
  status: BookingGroupStatus;

  // Per-night discount % applied to room rates booked under this group.
  // Stamped onto reservation.totalPrice at creation time so historical
  // bills don't shift if the group rate is later edited.
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  discountPercent: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ─── Routing ─────────────────────────────────────────────────
  // When true, all member-reservation room-charges and POS sales auto-
  // route to the master folio. When false, only explicit group-level
  // charges land here; members keep their own folios.
  @Column({ default: true })
  routeAllToMaster: boolean;

  // ─── Master folio ────────────────────────────────────────────
  @Column({ nullable: true })
  masterFolioId: string;

  @ManyToOne(() => Folio, { nullable: true })
  @JoinColumn({ name: 'masterFolioId' })
  masterFolio: Folio;

  // Member reservations. Cascade is intentionally NOT set — removing a
  // group should NOT silently delete reservations; the operator does it
  // explicitly via removeReservation().
  @OneToMany(() => Reservation, (r) => r.group)
  reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;
}
