import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A type of other-income (Доп. услуги, Сдача в аренду, Мероприятия, …).
 * Admin-managed directory; an Income references one. `group` buckets
 * categories for the P&L breakdown. Mirrors {@link ExpenseCategory}.
 */
@Entity('income_categories')
@Index(['name'], { unique: true })
export class IncomeCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // service | rent | event | asset | partner | grant | other — for grouping
  // in reports.
  @Column({ length: 20, default: 'other' })
  group: string;

  @Column({ length: 40, nullable: true })
  icon: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
