import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Outlet } from './outlet.entity';

@Entity('user_outlets')
export class UserOutlet {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  outletId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outletId' })
  outlet: Outlet;

  @CreateDateColumn()
  createdAt: Date;
}
