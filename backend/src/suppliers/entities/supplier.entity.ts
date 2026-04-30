import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Supplier directory. Receipts and lot rows previously held a free-text
 * `supplier` string — fine for display, useless for "show me everything
 * we received from supplier X over the last quarter". This entity is the
 * canonical row; legacy string fields remain on the receiving side as
 * denormalized cache for backwards-compat with reports that don't JOIN.
 */
@Entity('suppliers')
@Index(['name'], { unique: true })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 200, nullable: true })
  contactPerson: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
