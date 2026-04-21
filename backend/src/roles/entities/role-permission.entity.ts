import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roleId: string;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ length: 50 })
  action: string; // 'manage' | 'create' | 'read' | 'update' | 'delete'

  @Column({ length: 50 })
  subject: string; // 'Transaction' | 'Order' | 'Room' | 'Warehouse' | 'User' | 'all' etc.

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any> | null;

  @Column({ default: false })
  inverted: boolean; // true = "cannot" instead of "can"
}
