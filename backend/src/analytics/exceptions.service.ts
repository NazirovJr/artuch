import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from '../pos/entities/refund.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { FolioCharge } from '../folios/entities/folio-charge.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { OrderEditLog } from '../restaurant/entities/order-edit-log.entity';
import { CleaningTask } from '../cleaning/entities/cleaning-task.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

/**
 * Aggregations the owner uses to spot abuse: who is refunding the most,
 * who is giving the biggest discounts, which shifts came up short on cash.
 * Designed to be cheap — no joins needed; just GROUP BY in a single SQL.
 */
@Injectable()
export class ExceptionsService {
  constructor(
    @InjectRepository(Refund)
    private readonly refundsRepo: Repository<Refund>,
    @InjectRepository(Transaction)
    private readonly transRepo: Repository<Transaction>,
    @InjectRepository(FolioCharge)
    private readonly chargesRepo: Repository<FolioCharge>,
    @InjectRepository(Shift)
    private readonly shiftsRepo: Repository<Shift>,
    @InjectRepository(OrderEditLog)
    private readonly orderEditsRepo: Repository<OrderEditLog>,
    @InjectRepository(CleaningTask)
    private readonly cleaningRepo: Repository<CleaningTask>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Per-employee refund totals over a window. */
  async refundsByEmployee(filters: { from?: string; to?: string } = {}) {
    const qb = this.refundsRepo
      .createQueryBuilder('r')
      .select('r.employeeId', 'employeeId')
      .addSelect('r.employeeName', 'employeeName')
      .addSelect('COUNT(r.id)', 'count')
      .addSelect('SUM(r.amount)', 'totalAmount')
      .groupBy('r.employeeId')
      .addGroupBy('r.employeeName')
      .orderBy('"totalAmount"', 'DESC');
    if (filters.from) qb.andWhere('r.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('r.createdAt <= :to', { to: filters.to });
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      count: parseInt(r.count, 10) || 0,
      totalAmount: parseFloat(r.totalAmount) || 0,
    }));
  }

  /** Per-employee discount totals (folio discount charges). */
  async discountsByEmployee(filters: { from?: string; to?: string } = {}) {
    const qb = this.chargesRepo
      .createQueryBuilder('c')
      .select('c.addedBy', 'addedBy')
      .addSelect('COUNT(c.id)', 'count')
      .addSelect('SUM(ABS(c.amount))', 'totalAmount')
      .where("c.chargeType = 'discount'")
      .groupBy('c.addedBy')
      .orderBy('"totalAmount"', 'DESC');
    if (filters.from) qb.andWhere('c.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('c.createdAt <= :to', { to: filters.to });
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      employeeId: r.addedBy,
      count: parseInt(r.count, 10) || 0,
      totalAmount: parseFloat(r.totalAmount) || 0,
    }));
  }

  /** Closed shifts whose variance is non-zero. */
  async shiftsWithVariance(filters: { from?: string; to?: string } = {}) {
    const qb = this.shiftsRepo
      .createQueryBuilder('s')
      .where("s.status = 'closed'")
      .andWhere('s.variance IS NOT NULL')
      .andWhere('s.variance != 0')
      .orderBy('ABS(s.variance)', 'DESC')
      .limit(100);
    if (filters.from) qb.andWhere('s.openedAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('s.openedAt <= :to', { to: filters.to });
    return qb.getMany();
  }

  /** Order-item edits performed on protected orders (cooking/ready/...). */
  async orderEditsOnProtected(filters: { from?: string; to?: string } = {}) {
    const qb = this.orderEditsRepo
      .createQueryBuilder('l')
      .where("l.orderStatusAtEdit IN ('preparing','ready','completed')")
      .orderBy('l.createdAt', 'DESC')
      .limit(100);
    if (filters.from) qb.andWhere('l.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('l.createdAt <= :to', { to: filters.to });
    return qb.getMany();
  }

  /** Cleaning tasks that supervisors marked skipped. */
  async skippedCleaningTasks(filters: { from?: string; to?: string } = {}) {
    const qb = this.cleaningRepo
      .createQueryBuilder('t')
      .where("t.status = 'skipped'")
      .orderBy('t.completedAt', 'DESC')
      .limit(100);
    if (filters.from) qb.andWhere('t.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('t.createdAt <= :to', { to: filters.to });
    return qb.getMany();
  }

  /** Combined exception summary the owner-feed UI consumes. */
  async getSummary(filters: { from?: string; to?: string } = {}) {
    const [refunds, discounts, variances, edits, skipped] = await Promise.all([
      this.refundsByEmployee(filters),
      this.discountsByEmployee(filters),
      this.shiftsWithVariance(filters),
      this.orderEditsOnProtected(filters),
      this.skippedCleaningTasks(filters),
    ]);
    return { refunds, discounts, variances, orderEdits: edits, skippedCleaning: skipped };
  }

  /**
   * Recent risky activity feed: pulls the last N audit-log entries with
   * actions tied to high-trust operations. Cheaper than re-querying every
   * underlying table when the owner just wants a chronological stream.
   */
  async getOwnerFeed(limit = 50) {
    const RISKY_ACTIONS = [
      'create',
      'update-status',
      'update-items',
      'add-discount',
      'close',
      'skip',
      'reject',
      'delete',
    ];
    const RISKY_SUBJECTS = [
      'Refund',
      'Folio',
      'Shift',
      'Order',
      'CleaningTask',
      'Reservation',
      'User',
      'Role',
    ];
    return this.auditRepo
      .createQueryBuilder('log')
      .where('log.subject IN (:...subjects)', { subjects: RISKY_SUBJECTS })
      .andWhere('log.action IN (:...actions)', { actions: RISKY_ACTIONS })
      .orderBy('log.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
