import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId: string;
    userName: string;
    action: string;
    subject: string;
    subjectId?: string;
    changes?: Record<string, any>;
    ipAddress?: string;
  }): Promise<AuditLog> {
    const entry = this.auditRepo.create(data);
    return this.auditRepo.save(entry);
  }

  async findAll(filters?: {
    userId?: string;
    subject?: string;
    from?: string;
    to?: string;
  }): Promise<AuditLog[]> {
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .limit(100);

    if (filters?.userId) {
      qb.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters?.subject) {
      qb.andWhere('log.subject = :subject', { subject: filters.subject });
    }
    if (filters?.from) {
      qb.andWhere('log.createdAt >= :from', { from: filters.from });
    }
    if (filters?.to) {
      qb.andWhere('log.createdAt <= :to', { to: filters.to });
    }

    return qb.getMany();
  }
}
