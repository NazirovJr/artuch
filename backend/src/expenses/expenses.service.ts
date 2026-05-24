import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Workbook } from 'exceljs';
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  bank: 'Банк/перевод',
  other: 'Прочее',
};
const STATUS_LABELS: Record<string, string> = {
  recorded: 'Проведена',
  void: 'Отменена',
};
import { Shift } from '../shifts/entities/shift.entity';
import { EventsService } from '../events/events.service';
import { CreateExpenseDto } from './dto/expense.dto';

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  group?: string;
  outletId?: string;
  paymentMethod?: string;
  status?: string;
  q?: string;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: { categoryId: string; name: string; amount: number; count: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

// Spends at or above this surface to the owner feed as an info-level
// risky-action. There's no PIN gate (by product decision) — this is purely a
// visibility signal, never a block.
const LARGE_EXPENSE = 1000;

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    @InjectRepository(ExpenseCategory)
    private readonly catRepo: Repository<ExpenseCategory>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private readonly events: EventsService,
  ) {}

  async create(
    data: CreateExpenseDto,
    actor: { id: string; name?: string },
  ): Promise<Expense> {
    const category = await this.catRepo.findOne({
      where: { id: data.categoryId },
    });
    if (!category) throw new NotFoundException('Категория затрат не найдена');
    if (!category.isActive)
      throw new ConflictException('Категория затрат неактивна');

    const paymentMethod = data.paymentMethod || 'cash';

    // Cash paid out of an open till is tied to that shift so it can be
    // subtracted from expected cash at close (petty-cash accountability).
    let shiftId: string | undefined;
    if (paymentMethod === 'cash') {
      const openShift = await this.shiftRepo.findOne({
        where: { userId: actor.id, status: 'open' },
      });
      if (openShift) shiftId = openShift.id;
    }

    const saved = await this.repo.save(
      this.repo.create({
        categoryId: category.id,
        categoryName: category.name,
        amount: data.amount,
        paymentMethod,
        spentAt: data.spentAt,
        description: data.description,
        supplierId: data.supplierId,
        vendor: data.vendor,
        outletId: data.outletId,
        recordedBy: actor.id,
        recordedByName: actor.name,
        shiftId,
        status: 'recorded',
      }),
    );

    if (Number(saved.amount) >= LARGE_EXPENSE) {
      this.events.emitRiskyAction({
        type: 'expense',
        severity: 'info',
        title: `Крупная затрата ${Number(saved.amount).toFixed(2)} TJS`,
        detail: `${saved.categoryName}${saved.description ? ` — ${saved.description}` : ''}`,
        actorId: actor.id,
        actorName: actor.name,
        amount: Number(saved.amount),
        subjectId: saved.id,
        subject: 'Expense',
      });
    }

    return saved;
  }

  list(filters: ExpenseFilters): Promise<Expense[]> {
    return this.applyFilters(this.repo.createQueryBuilder('e'), filters)
      .orderBy('e.spentAt', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Shared WHERE builder for list / summary / export so every surface honours
   * the same filter set. `group` joins the category directory; `q` is a free
   * text match over vendor + description.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Expense>,
    f: ExpenseFilters,
  ): SelectQueryBuilder<Expense> {
    if (f.from) qb.andWhere('e.spentAt >= :from', { from: f.from });
    if (f.to) qb.andWhere('e.spentAt <= :to', { to: f.to });
    if (f.categoryId)
      qb.andWhere('e.categoryId = :categoryId', { categoryId: f.categoryId });
    if (f.outletId) qb.andWhere('e.outletId = :outletId', { outletId: f.outletId });
    if (f.status) qb.andWhere('e.status = :status', { status: f.status });
    if (f.paymentMethod)
      qb.andWhere('e.paymentMethod = :pm', { pm: f.paymentMethod });
    if (f.group) {
      // categoryId is varchar but ExpenseCategory.id is uuid — cast the
      // subquery to text so the IN comparison types line up.
      qb.andWhere(
        'e.categoryId IN ' +
          qb
            .subQuery()
            .select('CAST(c.id AS text)')
            .from(ExpenseCategory, 'c')
            .where('c.group = :grp')
            .getQuery(),
      ).setParameter('grp', f.group);
    }
    if (f.q) {
      qb.andWhere(
        '(e.vendor ILIKE :q OR e.description ILIKE :q OR e.categoryName ILIKE :q)',
        { q: `%${f.q}%` },
      );
    }
    return qb;
  }

  async void(
    id: string,
    reason: string | undefined,
    actor: { id: string; name?: string },
  ): Promise<Expense> {
    const expense = await this.repo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Затрата не найдена');
    if (expense.status === 'void')
      throw new ConflictException('Затрата уже отменена');

    expense.status = 'void';
    if (reason) expense.voidReason = reason;
    expense.voidedBy = actor.id;
    const saved = await this.repo.save(expense);

    this.events.emitRiskyAction({
      type: 'expense',
      severity: 'warning',
      title: `Отмена затраты ${Number(saved.amount).toFixed(2)} TJS`,
      detail: `${saved.categoryName}${reason ? ` — ${reason}` : ''}`,
      actorId: actor.id,
      actorName: actor.name,
      amount: Number(saved.amount),
      subjectId: saved.id,
      subject: 'Expense',
    });

    return saved;
  }

  // Aggregates over recorded (non-void) expenses — drives the list header and
  // is mirrored by FinanceService for the P&L.
  async summary(filters: ExpenseFilters = {}): Promise<ExpenseSummary> {
    // Summary is "recorded" totals by default (P&L semantics); callers may
    // override status explicitly (e.g. to see voided aggregates).
    const f: ExpenseFilters = { ...filters, status: filters.status ?? 'recorded' };
    const base = () => this.applyFilters(this.repo.createQueryBuilder('e'), f);

    const totalRow = await base()
      .select('COALESCE(SUM(e.amount),0)', 'total')
      .addSelect('COUNT(e.id)', 'count')
      .getRawOne<{ total: string; count: string }>();

    const catRows = await base()
      .select('e.categoryId', 'categoryId')
      .addSelect('e.categoryName', 'name')
      .addSelect('SUM(e.amount)', 'amount')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('e.categoryId')
      .addGroupBy('e.categoryName')
      .getRawMany<{ categoryId: string; name: string; amount: string; count: string }>();

    const payRows = await base()
      .select('e.paymentMethod', 'method')
      .addSelect('SUM(e.amount)', 'amount')
      .groupBy('e.paymentMethod')
      .getRawMany<{ method: string; amount: string }>();

    return {
      total: Number(totalRow?.total) || 0,
      count: Number(totalRow?.count) || 0,
      byCategory: catRows
        .map((r) => ({
          categoryId: r.categoryId,
          name: r.name,
          amount: Number(r.amount) || 0,
          count: Number(r.count) || 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      byPaymentMethod: payRows
        .map((r) => ({ method: r.method || 'other', amount: Number(r.amount) || 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  /**
   * Line-level XLSX of the filtered expense register + a totals sheet. Honours
   * the same filters as list/summary so "export what I see" is exact.
   */
  async buildWorkbook(filters: ExpenseFilters): Promise<Buffer> {
    const [rows, summary] = await Promise.all([
      this.list(filters),
      this.summary(filters),
    ]);
    const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

    const wb = new Workbook();
    wb.creator = 'Artuch';
    wb.created = new Date();

    const ws = wb.addWorksheet('Затраты');
    ws.columns = [
      { header: '№', width: 8 },
      { header: 'Дата', width: 14 },
      { header: 'Категория', width: 26 },
      { header: 'Сумма', width: 14 },
      { header: 'Способ оплаты', width: 16 },
      { header: 'Получатель', width: 24 },
      { header: 'Описание', width: 32 },
      { header: 'Статус', width: 14 },
      { header: 'Внёс', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow([
        r.expenseNumber,
        r.spentAt,
        r.categoryName,
        money(r.amount),
        PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod,
        r.vendor || '',
        r.description || '',
        STATUS_LABELS[r.status] || r.status,
        r.recordedByName || '',
      ]);
    }

    const cat = wb.addWorksheet('Итоги по категориям');
    cat.columns = [{ width: 26 }, { width: 14 }, { width: 10 }];
    cat.addRow(['Категория', 'Сумма', 'Кол-во']).font = { bold: true };
    summary.byCategory.forEach((c) =>
      cat.addRow([c.name, money(c.amount), c.count]),
    );
    cat.addRow(['ИТОГО', money(summary.total), summary.count]).font = { bold: true };

    const pay = wb.addWorksheet('Итоги по оплате');
    pay.columns = [{ width: 20 }, { width: 14 }];
    pay.addRow(['Способ', 'Сумма']).font = { bold: true };
    summary.byPaymentMethod.forEach((p) =>
      pay.addRow([PAYMENT_LABELS[p.method] || p.method, money(p.amount)]),
    );

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
