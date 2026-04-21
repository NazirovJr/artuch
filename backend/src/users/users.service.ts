import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { UserOutlet } from '../outlets/entities/user-outlet.entity';

/**
 * Payload shared by `create` and `update`. Every field is optional at the
 * service layer — the controller enforces "password required on create"
 * via the UI / frontend, and we just save whatever we're handed.
 */
export interface UserWriteData {
  username?: string;
  password?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  roleId?: string;
  pin?: string;
  isActive?: boolean;
  outletIds?: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserOutlet)
    private userOutletRepo: Repository<UserOutlet>,
    private rolesService: RolesService,
    private dataSource: DataSource,
  ) {}

  async findAll(includeInactive = false): Promise<User[]> {
    // When includeInactive is on, we don't filter at all — owner / admin
    // can see soft-deleted accounts to restore them. Default behaviour is
    // unchanged (active only) so existing callers aren't surprised.
    return this.usersRepo.find(
      includeInactive ? undefined : { where: { isActive: true } },
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Like findById but also returns the list of outlet UUIDs the user is
   * assigned to — used by the edit form to pre-select outlet chips.
   * Returned shape matches the User entity + an extra `outletIds` array;
   * legacy callers that only look at User fields keep working.
   */
  async findByIdWithOutlets(
    id: string,
  ): Promise<User & { outletIds: string[] }> {
    const user = await this.findById(id);
    const rows = await this.userOutletRepo.find({ where: { userId: id } });
    return Object.assign(user, { outletIds: rows.map((r) => r.outletId) });
  }

  async create(data: UserWriteData): Promise<User> {
    if (!data.username || !data.username.trim()) {
      throw new BadRequestException('username is required');
    }
    if (!data.password || !data.password.trim()) {
      throw new BadRequestException('password is required');
    }
    if (!data.fullName || !data.fullName.trim()) {
      throw new BadRequestException('fullName is required');
    }

    const exists = await this.findByUsername(data.username);
    if (exists) throw new ConflictException('Username already exists');

    // Resolve the role pair — prefer the explicit name if given, then the
    // id, then fall back to the inverse lookup. Either way the DB ends up
    // with both fields populated so CASL (which reads `user.role` by name)
    // and any code that consults `roleId` stay in sync.
    const { role, roleId } = await this.resolveRolePair(data);
    if (!role) {
      throw new BadRequestException('role is required');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const pinHash = data.pin && data.pin.trim()
      ? await bcrypt.hash(data.pin.trim(), 12)
      : undefined;

    const entity = this.usersRepo.create({
      username: data.username.trim(),
      fullName: data.fullName.trim(),
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      isActive: data.isActive ?? true,
      role,
      roleId: roleId ?? undefined,
      pin: pinHash,
      passwordHash,
    });

    const saved = await this.usersRepo.save(entity);

    if (data.outletIds !== undefined) {
      await this.syncOutlets(saved.id, data.outletIds);
    }

    return saved;
  }

  async update(id: string, data: UserWriteData): Promise<User> {
    const user = await this.findById(id);

    // Username change → re-check uniqueness against other accounts. Skipping
    // this was the old bug that let two users share a name.
    if (data.username && data.username !== user.username) {
      const conflict = await this.findByUsername(data.username);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Username already exists');
      }
      user.username = data.username;
    }

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    // Role change — resolve name/id pair and update both columns.
    if (data.role !== undefined || data.roleId !== undefined) {
      const { role, roleId } = await this.resolveRolePair(data);
      if (role) {
        user.role = role;
        user.roleId = roleId ?? null as any;
      }
    }

    // Empty password / pin strings mean "don't touch" (standard edit-form
    // semantics: leave the field blank to keep the existing secret).
    if (data.password && data.password.length > 0) {
      user.passwordHash = await bcrypt.hash(data.password, 12);
    }
    if (data.pin !== undefined && data.pin !== null) {
      if (data.pin.length > 0) {
        user.pin = await bcrypt.hash(data.pin, 12);
      }
      // empty pin → keep existing hash
    }

    const saved = await this.usersRepo.save(user);

    if (data.outletIds !== undefined) {
      await this.syncOutlets(saved.id, data.outletIds);
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.usersRepo.save(user);
  }

  // ── helpers ─────────────────────────────────────────────────────────

  /**
   * Ensure both `role` (name) and `roleId` (uuid) are returned, regardless
   * of which one the caller sent. Throws BadRequestException with a
   * readable message when the referenced role doesn't exist — nicer than
   * the default NotFoundException from RolesService.
   */
  private async resolveRolePair(data: UserWriteData): Promise<{
    role?: string;
    roleId?: string;
  }> {
    try {
      if (data.role && data.role.trim()) {
        const r = await this.rolesService.findByName(data.role.trim());
        return { role: r.name, roleId: r.id };
      }
      if (data.roleId && data.roleId.trim()) {
        const r = await this.rolesService.findById(data.roleId.trim());
        return { role: r.name, roleId: r.id };
      }
    } catch {
      throw new BadRequestException(
        `Role "${data.role || data.roleId}" does not exist`,
      );
    }
    return {};
  }

  /**
   * Replace a user's outlet assignments atomically. Delete existing rows
   * then insert the new set in a single transaction so a partial failure
   * doesn't leave them half-empty.
   */
  private async syncOutlets(userId: string, outletIds: string[]): Promise<void> {
    const unique = Array.from(new Set((outletIds || []).filter(Boolean)));
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserOutlet, { userId });
      if (unique.length === 0) return;
      const rows = unique.map((outletId) =>
        manager.getRepository(UserOutlet).create({ userId, outletId }),
      );
      await manager.save(rows);
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Record a successful login: stamp time, reset failed-attempts counter and
   * persist the originating IP for audit/forensics.
   */
  async recordSuccessfulLogin(userId: string, ip?: string | null): Promise<void> {
    await this.usersRepo.update(userId, {
      lastLoginAt: new Date(),
      lastLoginIp: ip || null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  /**
   * Record a failed login. Increments the counter and, if MAX_FAILED_LOGINS
   * is reached, locks the account for LOCK_MINUTES so brute-force becomes
   * impractical. Returns the updated counts so callers can decide what to
   * surface to the client.
   */
  async recordFailedLogin(
    userId: string,
    maxAttempts = 5,
    lockMinutes = 10,
  ): Promise<{ attempts: number; lockedUntil: Date | null }> {
    const user = await this.findById(userId);
    const attempts = (user.failedLoginAttempts || 0) + 1;
    let lockedUntil: Date | null = null;
    if (attempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockMinutes * 60_000);
    }
    await this.usersRepo.update(userId, {
      failedLoginAttempts: attempts,
      lockedUntil,
    });
    return { attempts, lockedUntil };
  }

  isLocked(user: User): boolean {
    return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
  }
}
