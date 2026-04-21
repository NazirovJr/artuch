import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  name: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ default: false })
  isSystem: boolean;

  @OneToMany(() => RolePermission, (rp) => rp.role, { cascade: true })
  permissions: RolePermission[];

  @CreateDateColumn()
  createdAt: Date;
}
