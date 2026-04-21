import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

/**
 * Validates manager-level PINs for critical operations (refunds, discounts,
 * folio close with balance, reservation deletion). Returns the userId of the
 * approving manager, throws ForbiddenException on mismatch.
 */
@Injectable()
export class ManagerApprovalService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async validatePin(pin: string): Promise<string> {
    if (!pin) throw new ForbiddenException('Manager PIN required');
    const managers = await this.usersRepo.find({
      where: [
        { role: 'admin', isActive: true },
        { role: 'manager', isActive: true },
        { role: 'owner', isActive: true },
      ],
    });
    for (const m of managers) {
      if (!m.pin) continue;
      const ok = await bcrypt.compare(pin, m.pin);
      if (ok) return m.id;
    }
    throw new ForbiddenException('Invalid manager PIN');
  }
}
