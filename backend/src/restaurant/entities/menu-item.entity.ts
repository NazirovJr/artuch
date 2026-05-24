import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 200 })
  nameRu: string;

  @Column({ length: 200, nullable: true })
  nameTj: string; // Tajik language name

  @Column({ length: 20 })
  category: string;

  // Prep routing for this menu item. Drives whether ordering it sends a ticket
  // to the kitchen / bar KDS, or is served directly by the waiter ('none').
  // Defaults to 'kitchen' so existing rows keep their current behaviour.
  @Column({ length: 20, default: 'kitchen' })
  station: string; // 'kitchen' | 'bar' | 'none'

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
