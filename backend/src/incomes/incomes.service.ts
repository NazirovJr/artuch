import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Workbook } from 'exceljs';
import { Income } from './entities/income.entity';
import { IncomeCategory } from './entities/income-category.entity';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  bank: 'Банк/перевод',
  other: 'Прочее',
};
const STATUS_LABELS: Record<string, string> = {
  recorded: 'Проведён',
  void: 'Отменён',
};
import { Shift } from '../shifts/entities/shift.entity';
import { EventsService } from '../events/events.service';
import { CreateIncomeDto } from './dto/income.dto';

export interface IncomeFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  group?: string;
  outletId?: string;
  paymentMethod?: string;
  status?: string;
  q?: string;
}

export interface IncomeSummary {
  total: number;
  count: number;
  byCategory: { categoryId: string; name: string; amount: number; count: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

// Inflows at or above this surface to the owner feed as an info-level
// risky-action. Purely a visibility signal, never a block (mirrors expenses).
const LARGE_INCOME = 1000;

@Injectable()
export class IncomesService {
  constructor(
    @InjectRepository(Income)
    private readonly repo: Repository<Income>,
    @InjectRepository(IncomeCategory)
    private readonly catRepo: Repository<IncomeCategory>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private readonly events: EventsService,
  ) {}

  async create(
    data: CreateIncomeDto,
    actor: { id: string; name?: string },
  ): Promise<Income> {
    const category = await this.catRepo.findOne({
      where: { id: data.categoryId },
    });
    if (!category) throw new NotFoundException('Категория доходов не найдена');
    if (!category.isActive)
      throw new ConflictException('Категория доходов неактивна');

    const paymentMethod = data.paymentMethod || 'cash';

    // Cash received into an open till is tied to that shift so it can be
    // added to expected cash at close (till accountability).
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
        receivedAt: data.receivedAt,
        description: data.description,
        payer: data.payer,
        outletId: data.outletId,
        recordedBy: actor.id,
        recordedByName: actor.name,
        shiftId,
        status: 'recorded',
      }),
    );

    if (Number(saved.amount) >= LARGE_INCOME) {
      this.events.emitRiskyAction({
        type: 'income',
        severity: 'info',
        title: `Крупный доход ${Number(saved.amount).toFixed(2)} TJS`,
        detail: `${saved.categoryName}${saved.description ? ` — ${saved.description}` : ''}`,
        actorId: actor.id,
        actorName: actor.name,
        amount: Number(saved.amount),
        subjectId: saved.id,
        subject: 'Income',
      });
    }

    return saved;
  }

  list(filters: IncomeFilters): Promise<Income[]> {
    return this.applyFilters(this.repo.createQueryBuilder('i'), filters)
      .orderBy('i.receivedAt', 'DESC')
      .addOrderBy('i.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Shared WHERE builder for list / summary / export so every surface honours
   * the same filter set. `group` joins the category directory; `q` is a free
   * text match over payer + description.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Income>,
    f: IncomeFilters,
  ): SelectQueryBuilder<Income> {
    if (f.from) qb.andWhere('i.receivedAt >= :from', { from: f.from });
    if (f.to) qb.andWhere('i.receivedAt <= :to', { to: f.to });
    if (f.categoryId)
      qb.andWhere('i.categoryId = :categoryId', { categoryId: f.categoryId });
    if (f.outletId) qb.andWhere('i.outletId = :outletId', { outletId: f.outletId });
    if (f.status) qb.andWhere('i.status = :status', { status: f.status });
    if (f.paymentMethod)
      qb.andWhere('i.paymentMethod = :pm', { pm: f.paymentMethod });
    if (f.group) {
      // categoryId is varchar but IncomeCategory.id is uuid — cast the
      // subquery to text so the IN comparison types line up.
      qb.andWhere(
        'i.categoryId IN ' +
          qb
            .subQuery()
            .select('CAST(c.id AS text)')
            .from(IncomeCategory, 'c')
            .where('c.group = :grp')
            .getQuery(),
      ).setParameter('grp', f.group);
    }
    if (f.q) {
      qb.andWhere(
        '(i.payer ILIKE :q OR i.description ILIKE :q OR i.categoryName ILIKE :q)',
        { q: `%${f.q}%` },
      );
    }
    return qb;
  }

  async void(
    id: string,
    reason: string | undefined,
    actor: { id: string; name?: string },
  ): Promise<Income> {
    const income = await this.repo.findOne({ where: { id } });
    if (!income) throw new NotFoundException('Доход не найден');
    if (income.status === 'void')
      throw new ConflictException('Доход уже отменён');

    income.status = 'void';
    if (reason) income.voidReason = reason;
    income.voidedBy = actor.id;
    const saved = await this.repo.save(income);

    this.events.emitRiskyAction({
      type: 'income',
      severity: 'warning',
      title: `Отмена дохода ${Number(saved.amount).toFixed(2)} TJS`,
      detail: `${saved.categoryName}${reason ? ` — ${reason}` : ''}`,
      actorId: actor.id,
      actorName: actor.name,
      amount: Number(saved.amount),
      subjectId: saved.id,
      subject: 'Income',
    });

    return saved;
  }

  // Aggregates over recorded (non-void) incomes — drives the list header and
  // is mirrored by FinanceService for the P&L "прочие доходы" line.
  async summary(filters: IncomeFilters = {}): Promise<IncomeSummary> {
    // Summary is "recorded" totals by default; callers may override status.
    const f: IncomeFilters = { ...filters, status: filters.status ?? 'recorded' };
    const base = () => this.applyFilters(this.repo.createQueryBuilder('i'), f);

    const totalRow = await base()
      .select('COALESCE(SUM(i.amount),0)', 'total')
      .addSelect('COUNT(i.id)', 'count')
      .getRawOne<{ total: string; count: string }>();

    const catRows = await base()
      .select('i.categoryId', 'categoryId')
      .addSelect('i.categoryName', 'name')
      .addSelect('SUM(i.amount)', 'amount')
      .addSelect('COUNT(i.id)', 'count')
      .groupBy('i.categoryId')
      .addGroupBy('i.categoryName')
      .getRawMany<{ categoryId: string; name: string; amount: string; count: string }>();

    const payRows = await base()
      .select('i.paymentMethod', 'method')
      .addSelect('SUM(i.amount)', 'amount')
      .groupBy('i.paymentMethod')
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
   * Line-level XLSX of the filtered income register + a totals sheet. Honours
   * the same filters as list/summary so "export what I see" is exact.
   */
  async buildWorkbook(filters: IncomeFilters): Promise<Buffer> {
    const [rows, summary] = await Promise.all([
      this.list(filters),
      this.summary(filters),
    ]);
    const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

    const wb = new Workbook();
    wb.creator = 'Artuch';
    wb.created = new Date();

    const ws = wb.addWorksheet('Доходы');
    ws.columns = [
      { header: '№', width: 8 },
      { header: 'Дата', width: 14 },
      { header: 'Категория', width: 26 },
      { header: 'Сумма', width: 14 },
      { header: 'Способ', width: 16 },
      { header: 'Плательщик', width: 24 },
      { header: 'Описание', width: 32 },
      { header: 'Статус', width: 14 },
      { header: 'Внёс', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow([
        r.incomeNumber,
        r.receivedAt,
        r.categoryName,
        money(r.amount),
        PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod,
        r.payer || '',
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
