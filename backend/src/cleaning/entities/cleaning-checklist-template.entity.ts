import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Reusable checklist housekeeping must complete before a task can be moved
 * to review. Each item is `{ key, label, required }` — the cleaner submits
 * an answer per item and required items must be ticked.
 */
@Entity('cleaning_checklist_templates')
export class CleaningChecklistTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  type: string; // 'departure' | 'stayover' | 'deep'

  @Column({ type: 'jsonb' })
  items: Array<{ key: string; label: string; required: boolean }>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
