import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A unit of cleaning work for a specific room. Created automatically when a
 * reservation enters checked-out (departure cleaning) or daily for active
 * stay-overs, and may be created manually for deep cleaning or inspections.
 *
 * Status flow: pending → in-progress → review → done. From any state a
 * supervisor can move the task to skipped with a reason.
 */
@Entity('cleaning_tasks')
export class CleaningTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomNumber: number;

  @Column({ length: 20 })
  type: string; // 'departure' | 'stayover' | 'deep' | 'inspection'

  @Column({ length: 20, default: 'pending' })
  status: string; // 'pending' | 'in-progress' | 'review' | 'done' | 'skipped'

  @Column({ nullable: true })
  reservationId: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignedToName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ nullable: true })
  supervisorId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supervisorName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  supervisorApprovedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  checklistResult: any;

  @Column({ nullable: true })
  templateId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
