import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Workbook } from 'exceljs';
import { Transaction } from '../pos/entities/transaction.entity';
import { Refund } from '../pos/entities/refund.entity';
import { Folio } from '../folios/entities/folio.entity';
import { FolioCharge } from '../folios/entities/folio-charge.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Room } from '../hotel/entities/room.entity';
import { RoomType } from '../hotel/entities/room-type.entity';
// InventoryItem is referenced only inside a QueryBuilder join (cogs); the entity
// is auto-loaded app-wide, so no repository injection is needed here.
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Income } from '../incomes/entities/income.entity';

const OUTLET_LABELS: Record<string, string> = {
  shop: 'Магазин',
  bar: 'Бар',
  restaurant: 'Ресторан',
  rental: 'Прокат',
  sale: 'Продажа (касса)',
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  folio: 'На номер (фолио)',
};
const EXPENSE_PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  bank: 'Банк/перевод',
  other: 'Прочее',
};
const DAY_MS = 86_400_000;

// Cross-cutting filters that narrow the transaction-backed figures. Applied to
// revenue, COGS, expenses and other income (all carry outletId + paymentMethod
// columns). Rooms / rentals / receivables aren't outlet-scoped, so they ignore
// these (the UI flags that).
export interface FinanceFilters {
  outletId?: string;
  paymentMethod?: string;
}

export interface FinanceSummary {
  range: { from: string; to: string };
  revenue: {
    gross: number;
    net: number;
    refunds: number;
    discounts: number;
    count: number;
    byOutlet: { type: string; label: string; amount: number; count: number }[];
    byCategory: { name: string; qty: number; amount: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  rooms: {
    revenue: number;
    roomNights: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    byRoomType: { code: string; name: string; revenue: number; nights: number; reservations: number }[];
  };
  rentals: { revenue: number; count: number; byItem: { itemName: string; revenue: number; qty: number }[] };
  receivables: {
    paid: number;
    outstanding: number;
    openFolios: number;
    depositsHeld: number;
    aging: { bucket: string; amount: number; count: number }[];
  };
  cogs: { goodsRevenue: number; cost: number; grossProfit: number; marginPct: number };
  expenses: {
    total: number;
    count: number;
    byCategory: { name: string; amount: number; count: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  // Manually-recorded inflows not captured by POS / rooms / rentals
  // ("прочие доходы") — kept separate from `revenue` to avoid double counting.
  otherIncome: {
    total: number;
    count: number;
    byCategory: { name: string; amount: number; count: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  // Closes the report into a P&L:
  //   net revenue + other income − goods cost − operating expenses.
  profit: { operatingProfit: number; marginPct: number };
  comparison: {
    prev: { from: string; to: string };
    revenuePrev: number;
    deltaPct: number | null;
    // Daily points aligned by day index, zero-filled to equal length — for the
    // "period over period" overlay chart (revenue / тx count / avg check).
    current: { revenue: number; count: number }[];
    previous: { revenue: number; count: number }[];
  };
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Folio) private readonly folioRepo: Repository<Folio>,
    @InjectRepository(FolioCharge) private readonly chargeRepo: Repository<FolioCharge>,
    @InjectRepository(Rental) private readonly rentalRepo: Repository<Rental>,
    @InjectRepository(Reservation) private readonly resRepo: Repository<Reservation>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomType) private readonly roomTypeRepo: Repository<RoomType>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Income) private readonly incomeRepo: Repository<Income>,
  ) {}

  private resolveRange(from?: string, to?: string): { start: Date; end: Date } {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return { start, end };
  }

  async getSummary(
    from?: string,
    to?: string,
    filters: FinanceFilters = {},
  ): Promise<FinanceSummary> {
    const { start, end } = this.resolveRange(from, to);

    const [revenue, rooms, rentals, receivables, cogs, expenses, otherIncome] =
      await Promise.all([
        this.revenue(start, end, filters),
        this.rooms(start, end),
        this.rentals(start, end),
        this.receivables(),
        this.cogs(start, end, filters),
        this.expenses(start, end, filters),
        this.otherIncome(start, end, filters),
      ]);
    const comparison = await this.comparison(start, end, revenue.gross);

    const operatingProfit =
      revenue.net + otherIncome.total - cogs.cost - expenses.total;
    // Margin is taken against total income (net revenue + other income) so the
    // denominator matches what actually came in.
    const incomeBase = revenue.net + otherIncome.total;
    const profit = {
      operatingProfit,
      marginPct: incomeBase > 0 ? (operatingProfit / incomeBase) * 100 : 0,
    };

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      revenue,
      rooms,
      rentals,
      receivables,
      cogs,
      expenses,
      otherIncome,
      profit,
      comparison,
    };
  }

  // Apply outlet / payment-method filters to a transaction query (alias 't').
  private applyTxFilters(
    qb: SelectQueryBuilder<Transaction>,
    f: FinanceFilters,
  ): SelectQueryBuilder<Transaction> {
    if (f.outletId) qb.andWhere('t.outletId = :fOutlet', { fOutlet: f.outletId });
    if (f.paymentMethod)
      qb.andWhere('t.paymentMethod = :fPm', { fPm: f.paymentMethod });
    return qb;
  }

  // ── Revenue ────────────────────────────────────────────────────────
  private async revenue(
    start: Date,
    end: Date,
    filters: FinanceFilters = {},
  ): Promise<FinanceSummary['revenue']> {
    const range = { start, end };
    const notRefunded = "t.status != 'refunded'";
    const base = () =>
      this.applyTxFilters(
        this.txRepo
          .createQueryBuilder('t')
          .where('t.createdAt BETWEEN :start AND :end', range)
          .andWhere(notRefunded),
        filters,
      );

    const grossRow = await base()
      .select('COALESCE(SUM(t.total),0)', 'gross')
      .addSelect('COUNT(t.id)', 'count')
      .getRawOne<{ gross: string; count: string }>();

    const outletRows = await base()
      .select('t.type', 'type')
      .addSelect('SUM(t.total)', 'amount')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy('t.type')
      .getRawMany<{ type: string; amount: string; count: string }>();

    const payRows = await base()
      .select('t.paymentMethod', 'method')
      .addSelect('SUM(t.total)', 'amount')
      .groupBy('t.paymentMethod')
      .getRawMany<{ method: string; amount: string }>();

    const catRows = await base()
      .innerJoin('t.items', 'ti')
      .select('ti.name', 'name')
      .addSelect('SUM(ti.quantity)', 'qty')
      .addSelect('SUM(ti.price * ti.quantity)', 'amount')
      .groupBy('ti.name')
      .getRawMany<{ name: string; qty: string; amount: string }>();

    const refundRow = await this.refundRepo
      .createQueryBuilder('r')
      .where('r.createdAt BETWEEN :start AND :end', range)
      .select('COALESCE(SUM(r.amount),0)', 'v')
      .getRawOne<{ v: string }>();

    const discRow = await this.chargeRepo
      .createQueryBuilder('c')
      .where('c.createdAt BETWEEN :start AND :end', range)
      .andWhere("c.chargeType = 'discount'")
      .select('COALESCE(SUM(ABS(c.amount)),0)', 'v')
      .getRawOne<{ v: string }>();

    const gross = Number(grossRow?.gross) || 0;
    const refunds = Number(refundRow?.v) || 0;
    const discounts = Number(discRow?.v) || 0;

    return {
      gross,
      refunds,
      discounts,
      net: gross - refunds - discounts,
      count: Number(grossRow?.count) || 0,
      byOutlet: outletRows
        .map((r) => ({
          type: r.type || 'unknown',
          label: OUTLET_LABELS[r.type] || r.type || 'Прочее',
          amount: Number(r.amount) || 0,
          count: Number(r.count) || 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      byCategory: catRows
        .map((r) => ({ name: r.name, qty: Number(r.qty) || 0, amount: Number(r.amount) || 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20),
      byPaymentMethod: payRows
        .map((r) => ({
          method: r.method || 'unknown',
          label: PAYMENT_LABELS[r.method] || r.method || 'Прочее',
          amount: Number(r.amount) || 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  // ── Rooms (ADR / RevPAR / occupancy / by room type) ────────────────
  private async rooms(start: Date, end: Date): Promise<FinanceSummary['rooms']> {
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);

    const [reservations, allRooms, roomTypes] = await Promise.all([
      this.resRepo
        .createQueryBuilder('r')
        .where('r.checkInDate BETWEEN :s AND :e', { s, e })
        .andWhere("r.status != 'cancelled'")
        .getMany(),
      this.roomRepo.find(),
      this.roomTypeRepo.find(),
    ]);

    const rtById = new Map(roomTypes.map((t) => [t.id, t]));
    const roomByNum = new Map(allRooms.map((rm) => [rm.number, rm]));

    const nightsOf = (r: Reservation): number => {
      const ci = new Date(r.checkInDate).getTime();
      const co = new Date(r.checkOutDate).getTime();
      return Math.max(1, Math.round((co - ci) / DAY_MS));
    };

    let revenue = 0;
    let roomNights = 0;
    const byType = new Map<string, { code: string; name: string; revenue: number; nights: number; reservations: number }>();

    for (const r of reservations) {
      const nights = nightsOf(r);
      const price = Number(r.totalPrice) || 0;
      revenue += price;
      roomNights += nights;
      const rm = roomByNum.get(r.roomNumber);
      const rt = rm?.roomTypeId ? rtById.get(rm.roomTypeId) : undefined;
      const code = rt?.code || rm?.type || 'unknown';
      const name = rt?.name || rm?.type || 'Не указан';
      const acc = byType.get(code) || { code, name, revenue: 0, nights: 0, reservations: 0 };
      acc.revenue += price;
      acc.nights += nights;
      acc.reservations += 1;
      byType.set(code, acc);
    }

    const totalRooms = allRooms.length || 0;
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    const capacity = totalRooms * days;

    return {
      revenue,
      roomNights,
      occupancyRate: capacity > 0 ? (roomNights / capacity) * 100 : 0,
      adr: roomNights > 0 ? revenue / roomNights : 0,
      revpar: capacity > 0 ? revenue / capacity : 0,
      byRoomType: [...byType.values()].sort((a, b) => b.revenue - a.revenue),
    };
  }

  // ── Equipment rentals ──────────────────────────────────────────────
  private async rentals(start: Date, end: Date): Promise<FinanceSummary['rentals']> {
    const range = { start, end };
    const totalRow = await this.rentalRepo
      .createQueryBuilder('r')
      .where('r.issuedAt BETWEEN :start AND :end', range)
      .select('COALESCE(SUM(r.totalCharge),0)', 'revenue')
      .addSelect('COUNT(r.id)', 'count')
      .getRawOne<{ revenue: string; count: string }>();

    const itemRows = await this.rentalRepo
      .createQueryBuilder('r')
      .where('r.issuedAt BETWEEN :start AND :end', range)
      .select('r.itemName', 'itemName')
      .addSelect('SUM(r.totalCharge)', 'revenue')
      .addSelect('SUM(r.quantity)', 'qty')
      .groupBy('r.itemName')
      .getRawMany<{ itemName: string; revenue: string; qty: string }>();

    return {
      revenue: Number(totalRow?.revenue) || 0,
      count: Number(totalRow?.count) || 0,
      byItem: itemRows
        .map((r) => ({ itemName: r.itemName || '—', revenue: Number(r.revenue) || 0, qty: Number(r.qty) || 0 }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // ── Receivables (paid vs outstanding, aging, deposits) ─────────────
  private async receivables(): Promise<FinanceSummary['receivables']> {
    const openFolios = await this.folioRepo.find({ where: { status: 'open' } });

    let outstanding = 0;
    let paid = 0;
    const buckets = { '0-7': { amount: 0, count: 0 }, '8-30': { amount: 0, count: 0 }, '30+': { amount: 0, count: 0 } };
    const now = Date.now();

    for (const f of openFolios) {
      const balance = (Number(f.totalAmount) || 0) - (Number(f.paidAmount) || 0);
      paid += Number(f.paidAmount) || 0;
      if (balance <= 0) continue;
      outstanding += balance;
      const ageDays = Math.floor((now - new Date(f.openedAt).getTime()) / DAY_MS);
      const key = ageDays <= 7 ? '0-7' : ageDays <= 30 ? '8-30' : '30+';
      buckets[key].amount += balance;
      buckets[key].count += 1;
    }

    const depRow = await this.chargeRepo
      .createQueryBuilder('c')
      .innerJoin(Folio, 'f', 'f.id = c."folioId"')
      .where("f.status = 'open'")
      .andWhere("c.chargeType = 'deposit'")
      .select('COALESCE(SUM(ABS(c.amount)),0)', 'v')
      .getRawOne<{ v: string }>();

    return {
      paid,
      outstanding,
      openFolios: openFolios.length,
      depositsHeld: Number(depRow?.v) || 0,
      aging: [
        { bucket: '0–7 дней', amount: buckets['0-7'].amount, count: buckets['0-7'].count },
        { bucket: '8–30 дней', amount: buckets['8-30'].amount, count: buckets['8-30'].count },
        { bucket: '30+ дней', amount: buckets['30+'].amount, count: buckets['30+'].count },
      ],
    };
  }

  // ── COGS / margin (inventory-backed goods only) ────────────────────
  private async cogs(
    start: Date,
    end: Date,
    filters: FinanceFilters = {},
  ): Promise<FinanceSummary['cogs']> {
    const row = await this.applyTxFilters(
      this.txRepo
        .createQueryBuilder('t')
        .innerJoin('t.items', 'ti')
        .innerJoin(InventoryItem, 'inv', 'inv.name = ti.name')
        .where('t.createdAt BETWEEN :start AND :end', { start, end })
        .andWhere("t.status != 'refunded'"),
      filters,
    )
      .select('COALESCE(SUM(ti.price * ti.quantity),0)', 'revenue')
      .addSelect('COALESCE(SUM(inv."purchasePrice" * ti.quantity),0)', 'cost')
      .getRawOne<{ revenue: string; cost: string }>();

    const goodsRevenue = Number(row?.revenue) || 0;
    const cost = Number(row?.cost) || 0;
    return {
      goodsRevenue,
      cost,
      grossProfit: goodsRevenue - cost,
      marginPct: goodsRevenue > 0 ? ((goodsRevenue - cost) / goodsRevenue) * 100 : 0,
    };
  }

  // ── Operating expenses (recorded only) ────────────────────────────
  private async expenses(
    start: Date,
    end: Date,
    filters: FinanceFilters = {},
  ): Promise<FinanceSummary['expenses']> {
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    const base = () => {
      const qb = this.expenseRepo
        .createQueryBuilder('e')
        .where("e.status = 'recorded'")
        .andWhere('e.spentAt BETWEEN :s AND :e', { s, e });
      if (filters.outletId)
        qb.andWhere('e.outletId = :fOutlet', { fOutlet: filters.outletId });
      if (filters.paymentMethod)
        qb.andWhere('e.paymentMethod = :fPm', { fPm: filters.paymentMethod });
      return qb;
    };

    const totalRow = await base()
      .select('COALESCE(SUM(e.amount),0)', 'total')
      .addSelect('COUNT(e.id)', 'count')
      .getRawOne<{ total: string; count: string }>();

    const catRows = await base()
      .select('e.categoryName', 'name')
      .addSelect('SUM(e.amount)', 'amount')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('e.categoryName')
      .getRawMany<{ name: string; amount: string; count: string }>();

    const payRows = await base()
      .select('e.paymentMethod', 'method')
      .addSelect('SUM(e.amount)', 'amount')
      .groupBy('e.paymentMethod')
      .getRawMany<{ method: string; amount: string }>();

    return {
      total: Number(totalRow?.total) || 0,
      count: Number(totalRow?.count) || 0,
      byCategory: catRows
        .map((r) => ({ name: r.name, amount: Number(r.amount) || 0, count: Number(r.count) || 0 }))
        .sort((a, b) => b.amount - a.amount),
      byPaymentMethod: payRows
        .map((r) => ({
          method: r.method || 'other',
          label: EXPENSE_PAYMENT_LABELS[r.method] || r.method || 'Прочее',
          amount: Number(r.amount) || 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  // ── Other income (recorded only; manual inflows outside POS/rooms/rentals) ─
  private async otherIncome(
    start: Date,
    end: Date,
    filters: FinanceFilters = {},
  ): Promise<FinanceSummary['otherIncome']> {
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    const base = () => {
      const qb = this.incomeRepo
        .createQueryBuilder('i')
        .where("i.status = 'recorded'")
        .andWhere('i.receivedAt BETWEEN :s AND :e', { s, e });
      if (filters.outletId)
        qb.andWhere('i.outletId = :fOutlet', { fOutlet: filters.outletId });
      if (filters.paymentMethod)
        qb.andWhere('i.paymentMethod = :fPm', { fPm: filters.paymentMethod });
      return qb;
    };

    const totalRow = await base()
      .select('COALESCE(SUM(i.amount),0)', 'total')
      .addSelect('COUNT(i.id)', 'count')
      .getRawOne<{ total: string; count: string }>();

    const catRows = await base()
      .select('i.categoryName', 'name')
      .addSelect('SUM(i.amount)', 'amount')
      .addSelect('COUNT(i.id)', 'count')
      .groupBy('i.categoryName')
      .getRawMany<{ name: string; amount: string; count: string }>();

    const payRows = await base()
      .select('i.paymentMethod', 'method')
      .addSelect('SUM(i.amount)', 'amount')
      .groupBy('i.paymentMethod')
      .getRawMany<{ method: string; amount: string }>();

    return {
      total: Number(totalRow?.total) || 0,
      count: Number(totalRow?.count) || 0,
      byCategory: catRows
        .map((r) => ({ name: r.name, amount: Number(r.amount) || 0, count: Number(r.count) || 0 }))
        .sort((a, b) => b.amount - a.amount),
      byPaymentMethod: payRows
        .map((r) => ({
          method: r.method || 'other',
          label: EXPENSE_PAYMENT_LABELS[r.method] || r.method || 'Прочее',
          amount: Number(r.amount) || 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  // ── Daily buckets (revenue + tx count, zero-filled, indexed from start) ──
  private async bucketDaily(
    startMidnight: Date,
    numDays: number,
  ): Promise<{ revenue: number; count: number }[]> {
    const end = new Date(startMidnight.getTime() + numDays * DAY_MS);
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .where('t.createdAt >= :s AND t.createdAt < :e', { s: startMidnight, e: end })
      .andWhere("t.status != 'refunded'")
      .select(`date_trunc('day', t."createdAt")`, 'day')
      .addSelect('SUM(t.total)', 'revenue')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy(`date_trunc('day', t."createdAt")`)
      .getRawMany<{ day: string; revenue: string; count: string }>();
    const series = Array.from({ length: numDays }, () => ({ revenue: 0, count: 0 }));
    for (const r of rows) {
      const idx = Math.round(
        (new Date(r.day).getTime() - startMidnight.getTime()) / DAY_MS,
      );
      if (idx >= 0 && idx < numDays) {
        series[idx] = { revenue: Number(r.revenue) || 0, count: Number(r.count) || 0 };
      }
    }
    return series;
  }

  // ── Comparison with previous equal-length range (+ daily overlay) ───
  private async comparison(
    start: Date,
    end: Date,
    grossNow: number,
  ): Promise<FinanceSummary['comparison']> {
    const curStart = new Date(start);
    curStart.setHours(0, 0, 0, 0);
    const numDays = Math.max(
      1,
      Math.round((end.getTime() - curStart.getTime()) / DAY_MS) + 1,
    );
    const prevStart = new Date(curStart.getTime() - numDays * DAY_MS);

    const [current, previous] = await Promise.all([
      this.bucketDaily(curStart, numDays),
      this.bucketDaily(prevStart, numDays),
    ]);
    const revenuePrev = previous.reduce((a, b) => a + b.revenue, 0);

    return {
      prev: {
        from: prevStart.toISOString(),
        to: new Date(curStart.getTime() - 1).toISOString(),
      },
      revenuePrev,
      deltaPct: revenuePrev > 0 ? ((grossNow - revenuePrev) / revenuePrev) * 100 : null,
      current,
      previous,
    };
  }

  // ── XLSX export ────────────────────────────────────────────────────
  // scope narrows the workbook: 'income' → income-side sheets only,
  // 'expense' → cost-side only, 'all' → the full report.
  async buildWorkbook(
    summary: FinanceSummary,
    scope: 'all' | 'income' | 'expense' = 'all',
  ): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'Artuch';
    wb.created = new Date();
    const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const d = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
    const wantIncome = scope !== 'expense';
    const wantExpense = scope !== 'income';

    // Сводка
    const title =
      scope === 'income'
        ? 'Доходы Artuch'
        : scope === 'expense'
          ? 'Расходы Artuch'
          : 'Финансовый отчёт Artuch';
    const s = wb.addWorksheet('Сводка');
    s.columns = [{ width: 34 }, { width: 20 }];
    s.addRow([title]).font = { bold: true, size: 14 };
    s.addRow(['Период', `${d(summary.range.from)} — ${d(summary.range.to)}`]);
    s.addRow([]);
    if (wantIncome) {
      s.addRow(['Выручка (валовая)', money(summary.revenue.gross)]);
      s.addRow(['Возвраты', money(summary.revenue.refunds)]);
      s.addRow(['Скидки', money(summary.revenue.discounts)]);
      s.addRow(['Выручка (чистая)', money(summary.revenue.net)]).font = { bold: true };
      s.addRow(['Прочие доходы', money(summary.otherIncome.total)]);
      s.addRow(['Выручка по номерам', money(summary.rooms.revenue)]);
      s.addRow(['Выручка проката', money(summary.rentals.revenue)]);
      s.addRow(['Совокупный доход', money(summary.revenue.net + summary.otherIncome.total)]).font = { bold: true };
      s.addRow([]);
    }
    if (wantExpense) {
      s.addRow(['Себестоимость товаров', money(summary.cogs.cost)]);
      s.addRow(['Валовая прибыль (товары)', money(summary.cogs.grossProfit)]);
      s.addRow(['Маржа товаров, %', money(summary.cogs.marginPct)]);
      s.addRow(['Операционные затраты', money(summary.expenses.total)]);
      s.addRow(['Совокупные расходы', money(summary.cogs.cost + summary.expenses.total)]).font = { bold: true };
      s.addRow([]);
    }
    if (scope === 'all') {
      s.addRow(['Чистая прибыль', money(summary.profit.operatingProfit)]).font = { bold: true };
      s.addRow(['Рентабельность, %', money(summary.profit.marginPct)]);
      s.addRow([]);
      s.addRow(['Номеро-ночи', summary.rooms.roomNights]);
      s.addRow(['Загрузка, %', money(summary.rooms.occupancyRate)]);
      s.addRow(['ADR', money(summary.rooms.adr)]);
      s.addRow(['RevPAR', money(summary.rooms.revpar)]);
      s.addRow([]);
      s.addRow(['Оплачено (фолио)', money(summary.receivables.paid)]);
      s.addRow(['К оплате (дебиторка)', money(summary.receivables.outstanding)]).font = { bold: true };
      s.addRow(['Открытых фолио', summary.receivables.openFolios]);
      s.addRow(['Удержано депозитов', money(summary.receivables.depositsHeld)]);
      s.addRow(['Δ% к прошлому периоду', summary.comparison.deltaPct == null ? '—' : money(summary.comparison.deltaPct)]);
    }

    const sheetWith = (
      title: string,
      headers: string[],
      rows: (string | number)[][],
    ) => {
      const ws = wb.addWorksheet(title);
      ws.columns = headers.map(() => ({ width: 26 }));
      ws.addRow(headers).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));
    };

    if (wantIncome) {
      sheetWith(
        'Выручка по точкам',
        ['Точка', 'Сумма', 'Чеков'],
        summary.revenue.byOutlet.map((r) => [r.label, money(r.amount), r.count]),
      );
      sheetWith(
        'Выручка по категориям',
        ['Позиция', 'Кол-во', 'Сумма'],
        summary.revenue.byCategory.map((r) => [r.name, r.qty, money(r.amount)]),
      );
      sheetWith(
        'Способы оплаты',
        ['Способ', 'Сумма'],
        summary.revenue.byPaymentMethod.map((r) => [r.label, money(r.amount)]),
      );
      sheetWith(
        'Типы комнат',
        ['Тип', 'Выручка', 'Ночей', 'Броней'],
        summary.rooms.byRoomType.map((r) => [r.name, money(r.revenue), r.nights, r.reservations]),
      );
      sheetWith(
        'Прокат',
        ['Позиция', 'Выручка', 'Кол-во'],
        summary.rentals.byItem.map((r) => [r.itemName, money(r.revenue), r.qty]),
      );
      sheetWith(
        'Прочие доходы по типам',
        ['Категория', 'Сумма', 'Кол-во'],
        summary.otherIncome.byCategory.map((r) => [r.name, money(r.amount), r.count]),
      );
      sheetWith(
        'Прочие доходы по оплате',
        ['Способ', 'Сумма'],
        summary.otherIncome.byPaymentMethod.map((r) => [r.label, money(r.amount)]),
      );
    }
    if (scope === 'all') {
      sheetWith(
        'Дебиторка (старение)',
        ['Возраст', 'Сумма', 'Фолио'],
        summary.receivables.aging.map((r) => [r.bucket, money(r.amount), r.count]),
      );
    }
    if (wantExpense) {
      sheetWith(
        'Затраты по типам',
        ['Категория', 'Сумма', 'Кол-во'],
        summary.expenses.byCategory.map((r) => [r.name, money(r.amount), r.count]),
      );
      sheetWith(
        'Затраты по оплате',
        ['Способ', 'Сумма'],
        summary.expenses.byPaymentMethod.map((r) => [r.label, money(r.amount)]),
      );
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
