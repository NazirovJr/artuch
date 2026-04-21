import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

const MAX_FAILED_ATTEMPTS = Number(
  process.env.AUTH_MAX_FAILED_ATTEMPTS || '5',
);
const LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || '10');

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  /**
   * Password login. Tracks failed attempts and locks the account after
   * MAX_FAILED_ATTEMPTS for LOCK_MINUTES so brute-force is impractical.
   * On success, all of this user's existing refresh tokens are revoked so
   * a stolen PIN/password can't be used from two devices simultaneously.
   */
  async login(username: string, password: string, ip?: string | null) {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    this.assertNotLocked(user);

    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) {
      const { lockedUntil } = await this.usersService.recordFailedLogin(
        user.id,
        MAX_FAILED_ATTEMPTS,
        LOCK_MINUTES,
      );
      if (lockedUntil) {
        throw new ForbiddenException(
          `Account temporarily locked until ${lockedUntil.toISOString()}`,
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueSession(user, ip);
  }

  async loginWithPin(pin: string, ip?: string | null) {
    // Load all active users that have a PIN set
    const allUsers = await this.usersService.findAll();
    const usersWithPin = allUsers.filter((u) => u.pin != null);

    for (const user of usersWithPin) {
      // Skip locked accounts entirely so a single shared device can't be used
      // to lock everyone out by spamming pins.
      if (this.usersService.isLocked(user)) continue;
      const match = await bcrypt.compare(pin, user.pin!);
      if (match) {
        return this.issueSession(user, ip);
      }
    }

    throw new UnauthorizedException('Invalid PIN');
  }

  /**
   * Common post-credential-check path: revoke any existing sessions, mint
   * fresh tokens, stamp lastLoginAt/Ip and reset failed-attempts.
   */
  private async issueSession(user: User, ip?: string | null) {
    await this.refreshTokenRepo.delete({ userId: user.id });
    await this.usersService.recordSuccessfulLogin(user.id, ip);

    const payload = { sub: user.id, username: user.username, role: user.role };
    const refreshToken = await this.generateRefreshToken(user.id);
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  private assertNotLocked(user: User) {
    if (this.usersService.isLocked(user)) {
      throw new ForbiddenException(
        `Account temporarily locked until ${user.lockedUntil!.toISOString()}`,
      );
    }
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const plainToken = crypto.randomUUID();
    const hashedToken = await bcrypt.hash(plainToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const refreshToken = this.refreshTokenRepo.create({
      userId,
      token: hashedToken,
      expiresAt,
    });
    await this.refreshTokenRepo.save(refreshToken);

    return plainToken;
  }

  async refreshTokens(refreshToken: string) {
    // Find all non-expired refresh tokens
    const storedTokens = await this.refreshTokenRepo
      .createQueryBuilder('rt')
      .where('rt.expiresAt > :now', { now: new Date() })
      .getMany();

    for (const stored of storedTokens) {
      const match = await bcrypt.compare(refreshToken, stored.token);
      if (match) {
        // Found the matching token — delete it (one-time use)
        await this.refreshTokenRepo.remove(stored);

        // Generate new token pair
        const user = await this.usersService.findById(stored.userId);
        if (!user || !user.isActive) {
          throw new UnauthorizedException('User inactive');
        }
        const payload = { sub: user.id, username: user.username, role: user.role };
        const newRefreshToken = await this.generateRefreshToken(user.id);
        return {
          access_token: this.jwtService.sign(payload),
          refresh_token: newRefreshToken,
        };
      }
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async revokeRefreshToken(refreshToken: string) {
    const storedTokens = await this.refreshTokenRepo.find();

    for (const stored of storedTokens) {
      const match = await bcrypt.compare(refreshToken, stored.token);
      if (match) {
        await this.refreshTokenRepo.remove(stored);
        return;
      }
    }
    // If token not found, silently succeed (already revoked or expired)
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };
  }
}
