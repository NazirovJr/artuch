import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A type of operating expense (Аренда, Зарплаты, Коммунальные, …). Admin-
 * managed directory; an Expense references one. `group` buckets categories
 * for the P&L breakdown.
 */
@Entity('expense_categories')
@Index(['name'], { unique: true })
export class ExpenseCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // rent | payroll | utilities | supplies | transport | marketing |
  // maintenance | tax | other — for grouping in reports.
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
