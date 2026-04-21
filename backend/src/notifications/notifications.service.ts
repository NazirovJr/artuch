import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationsService');

  constructor(
    @InjectRepository(DeviceToken)
    private tokenRepo: Repository<DeviceToken>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async registerToken(userId: string, token: string, platform = 'android'): Promise<DeviceToken> {
    // Upsert: update if same userId+platform exists
    const existing = await this.tokenRepo.findOne({ where: { userId, platform } });
    if (existing) {
      existing.token = token;
      return this.tokenRepo.save(existing);
    }
    return this.tokenRepo.save(this.tokenRepo.create({ userId, token, platform }));
  }

  async unregisterToken(userId: string): Promise<void> {
    await this.tokenRepo.delete({ userId });
  }

  async sendToUser(userId: string, title: string, body: string): Promise<void> {
    const tokens = await this.tokenRepo.find({ where: { userId } });
    for (const dt of tokens) {
      // TODO: Integrate with Firebase Admin SDK
      this.logger.log(`[PUSH] To ${userId} (${dt.token.slice(0, 20)}...): ${title} - ${body}`);
    }
  }

  async sendToAll(title: string, body: string): Promise<void> {
    const tokens = await this.tokenRepo.find();
    this.logger.log(`[PUSH BROADCAST] ${title} - ${body} (${tokens.length} devices)`);
    // TODO: Firebase batch send
  }

  /**
   * Push to every active user that has any of the given roles. Used by the
   * risky-action pipeline to wake up owners/managers even if the staff app
   * is in the background.
   */
  async sendToRole(
    role: string | string[],
    title: string,
    body: string,
  ): Promise<void> {
    const roles = Array.isArray(role) ? role : [role];
    const users = await this.userRepo.find({
      where: roles.map((r) => ({ role: r, isActive: true })),
    });
    if (users.length === 0) return;
    const userIds = users.map((u) => u.id);
    const tokens = await this.tokenRepo.find({
      where: { userId: In(userIds) },
    });
    this.logger.log(
      `[PUSH ROLE ${roles.join(',')}] ${title} - ${body} (${tokens.length} devices, ${users.length} users)`,
    );
    // TODO: Firebase batch send
  }
}
