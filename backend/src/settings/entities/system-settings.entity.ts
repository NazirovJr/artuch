import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ type: 'varchar', default: 'global' })
  id: string;

  @Column({ type: 'varchar', nullable: true, length: 200 })
  hotelName: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  hotelAddress: string | null;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  hotelPhone: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  hotelEmail: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  hotelWebsite: string | null;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  hotelTaxId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000 })
  logoUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 10, default: 'TJS' })
  currency: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
