import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tours')
export class Tour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  categoryId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50, nullable: true })
  duration: string;

  @Column({ length: 20, nullable: true })
  difficulty: string;

  @Column({ length: 50, nullable: true })
  distance: string;

  @Column({ length: 50, nullable: true })
  altitude: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('text', { array: true, nullable: true })
  highlights: string[];

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ length: 50, nullable: true })
  groupSize: string;

  @Column({ length: 100, nullable: true })
  season: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
