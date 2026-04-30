import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Marketing-and-spec catalog row for a class of rooms. The physical Room
 * rows reference this via roomTypeId. One RoomType ⇆ many Room.
 *
 * Modeled after Mews/Cloudbeds/Opera schemas:
 *   - identity:     code (slug) + names + descriptions in RU/EN
 *   - capacity:     maxGuests, maxAdults, maxChildren, beds, bedConfiguration
 *   - physical:     sizeM2, view, floor hint
 *   - pricing:      basePrice, weekendPrice, taxIncluded
 *   - media:        photos[], coverPhoto, videoUrl
 *   - amenities:    list of slugs (wifi, ac, balcony, minibar, …)
 *   - policies:     smoking, pets, accessible, breakfastIncluded,
 *                   minStay, maxStay, childrenAllowed
 *
 * Photos and amenities are stored as JSONB arrays — fine here because we
 * never query "rooms with amenity X" via SQL; the staff app filters in
 * memory off the small admin list.
 */
@Entity('room_types')
@Index(['code'], { unique: true })
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stable slug; the staff app shows it as a chip and reservations link to
  // it via id, so renaming `name` doesn't break existing bookings.
  @Column({ length: 30 })
  code: string;

  // Marketing-facing names. RU is the primary surface; EN is for OTA feeds
  // and English-speaking guests. Default to RU display when EN is missing.
  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, nullable: true })
  nameEn: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn: string;

  // ─── Capacity ─────────────────────────────────────────────────
  @Column({ default: 2 })
  maxGuests: number;

  @Column({ default: 2 })
  maxAdults: number;

  @Column({ default: 0 })
  maxChildren: number;

  @Column({ default: 1 })
  beds: number;

  // Free-text bed layout, e.g. "1 king + 1 sofa" / "2 single". Industry
  // standard is to keep this textual — too many real-world combinations.
  @Column({ length: 80, nullable: true })
  bedConfiguration: string;

  // ─── Physical attributes ─────────────────────────────────────
  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  sizeM2: number;

  // 'mountain' | 'garden' | 'courtyard' | 'street' | 'pool'
  @Column({ length: 30, nullable: true })
  view: string;

  // ─── Pricing ─────────────────────────────────────────────────
  @Column('decimal', { precision: 10, scale: 2 })
  basePrice: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  weekendPrice: number;

  // VAT rate applied to room nights. Stored on the type so reservations
  // can stamp the active rate at booking time (PMS convention).
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  taxRate: number;

  @Column({ default: true })
  taxIncluded: boolean;

  // ─── Media ────────────────────────────────────────────────────
  // Array of URLs. coverPhoto is denormalised first-of-photos for fast
  // grid rendering without parsing the JSON column.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  photos: string[];

  @Column({ length: 500, nullable: true })
  coverPhoto: string;

  // YouTube/Vimeo/direct mp4 URL — clients embed via known providers or
  // open externally. We don't transcode anything here.
  @Column({ length: 500, nullable: true })
  videoUrl: string;

  // ─── Amenities ────────────────────────────────────────────────
  // Slug list. UI renders icons keyed off the slug, with a whitelist of
  // known values. Free-form values still render with a fallback chip.
  // Example: ['wifi', 'ac', 'balcony', 'minibar', 'safe', 'tv',
  //           'hairdryer', 'kettle', 'workspace', 'iron']
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  amenities: string[];

  // ─── Policies ─────────────────────────────────────────────────
  @Column({ default: false })
  smokingAllowed: boolean;

  @Column({ default: false })
  petsAllowed: boolean;

  @Column({ default: false })
  accessibleForDisabled: boolean;

  @Column({ default: true })
  childrenAllowed: boolean;

  @Column({ default: false })
  breakfastIncluded: boolean;

  @Column({ default: 1 })
  minStayNights: number;

  @Column({ default: 30 })
  maxStayNights: number;

  // ─── Lifecycle ────────────────────────────────────────────────
  @Column({ default: true })
  isActive: boolean;

  // Sort order in the admin grid. Lower = earlier. Defaults to 0; admins
  // can shuffle by editing this.
  @Column({ default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
