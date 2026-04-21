import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Shift } from './entities/shift.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { Refund } from '../pos/entities/refund.entity';
import { User } from '../users/entities/user.entity';
import { EventsService } from '../events/events.service';

const VARIANCE_THRESHOLD = Number(
  process.env.CASH_VARIANCE_THRESHOLD || '50',
);

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftsRepo: Repository<Shift>,
    @InjectRepository(Transaction)
    private readonly transRepo: Repository<Transaction>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly eventsService: EventsService,
  ) {}

  /** Returns the current open shift for a user, or null. */
  async findActiveByUser(userId: string): Promise<Shift | null> {
    return this.shiftsRepo.findOne({
      where: { userId, status: 'open' },
    });
  }

  async findActiveById(shiftId: string): Promise<Shift> {
    const shift = await this.shiftsRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  /**
   * Open a new shift. Throws ConflictException if user already has an open one.
   */
  async open(data: {
    userId: string;
    userName?: string;
    outletId?: string;
    openingCash?: number;
  }): Promise<Shift> {
    const existing = await this.findActiveByUser(data.userId);
    if (existing) {
      throw new ConflictException(
        `User ${data.userId} already has an open shift (${existing.id}). Close it before opening a new one.`,
      );
    }
    const shift = this.shiftsRepo.create({
      userId: data.userId,
      userName: data.userName ?? null,
      outletId: data.outletId ?? null,
      openedAt: new Date(),
      openingCash: data.openingCash ?? 0,
      status: 'open',
    });
    return this.shiftsRepo.save(shift);
  }

  /** Compute expected cash for an open shift from cash transactions/refunds. */
  async computeExpectedCash(shift: Shift): Promise<number> {
    const since = shift.openedAt;
    const until = new Date();

    const cashTx = await this.transRepo
      .createQueryBuilder('t')
      .where('t.createdAt BETWEEN :since AND :until', { since, until })
      .andWhere("t.paymentMethod = 'cash'")
      .andWhere('t.employeeId = :uid', { uid: shift.userId })
      .andWhere("t.type = 'sale'")
      .getMany();

    const cashRefunds = await this.refundRepo
      .createQueryBuilder('r')
      .where('r.createdAt BETWEEN :since AND :until', { since, until })
      .andWhere('r.employeeId = :uid', { uid: shift.userId })
      .getMany();

    const sales = cashTx.reduce((sum, t) => sum + Number(t.total), 0);
    const refunds = cashRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
    return Number(shift.openingCash) + sales - refunds;
  }

  /**
   * Close a shift with blind cash count. If |variance| exceeds threshold,
   * a managerPin must be provided and validated against an admin/manager user.
   */
  async close(
    shiftId: string,
    data: { actualCash: number; managerPin?: string; notes?: string },
  ): Promise<Shift> {
    const shift = await this.findActiveById(shiftId);
    if (shift.status !== 'open') {
      throw new ConflictException(`Shift ${shiftId} is not open`);
    }

    const expected = await this.computeExpectedCash(shift);
    const variance = Number(data.actualCash) - expected;
    const absVariance = Math.abs(variance);

    let approvedBy: string | null = null;
    if (absVariance > VARIANCE_THRESHOLD) {
      if (!data.managerPin) {
        throw new ForbiddenException(
          `Cash variance ${variance.toFixed(2)} exceeds threshold ${VARIANCE_THRESHOLD}. Manager PIN required.`,
        );
      }
      approvedBy = await this.validateManagerPin(data.managerPin);
    }

    shift.expectedCash = expected;
    shift.actualCash = Number(data.actualCash);
    shift.variance = variance;
    shift.closedAt = new Date();
    shift.status = 'closed';
    shift.closeApprovedBy = approvedBy;
    if (data.notes) shift.notes = data.notes;
    const saved = await this.shiftsRepo.save(shift);

    if (absVariance > 0) {
      this.eventsService.emitRiskyAction({
        type: 'shift-variance',
        severity:
          absVariance > VARIANCE_THRESHOLD ? 'critical' : 'warning',
        title: `Расхождение кассы ${variance.toFixed(2)} TJS`,
        detail: `${shift.userName || shift.userId}: ожидалось ${expected.toFixed(2)}, по факту ${Number(data.actualCash).toFixed(2)}`,
        actorId: shift.userId,
        actorName: shift.userName ?? undefined,
        amount: Math.abs(variance),
        subjectId: saved.id,
        subject: 'Shift',
      });
    }

    return saved;
  }

  /**
   * Validates a manager PIN against active admin/manager users. Returns the
   * approving user's id, throws ForbiddenException if no match.
   */
  async validateManagerPin(pin: string): Promise<string> {
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

  /** List shifts with filters for analytics. */
  async findAll(filters: {
    userId?: string;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<Shift[]> {
    const qb = this.shiftsRepo
      .createQueryBuilder('s')
      .orderBy('s.openedAt', 'DESC')
      .limit(200);
    if (filters.userId) qb.andWhere('s.userId = :uid', { uid: filters.userId });
    if (filters.status) qb.andWhere('s.status = :st', { st: filters.status });
    if (filters.from) qb.andWhere('s.openedAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('s.openedAt <= :to', { to: filters.to });
    return qb.getMany();
  }

  /**
   * Asserts that the user has an open shift for the given outlet (if any).
   * Used by PosService before creating transactions/refunds.
   * Returns the active shift.
   */
  async requireActiveShift(
    userId: string,
    outletId?: string,
  ): Promise<Shift> {
    const shift = await this.findActiveByUser(userId);
    if (!shift) {
      throw new ForbiddenException(
        'No open shift. Open a shift before performing POS operations.',
      );
    }
    if (outletId && shift.outletId && shift.outletId !== outletId) {
      throw new ForbiddenException(
        `Active shift belongs to outlet ${shift.outletId}, but operation is for ${outletId}.`,
      );
    }
    return shift;
  }
}
