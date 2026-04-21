import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 500 })
  token: string;

  @Column({ length: 20, default: 'android' })
  platform: string;

  @CreateDateColumn()
  createdAt: Date;
}
