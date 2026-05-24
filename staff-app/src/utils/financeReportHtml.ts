import type { FinanceSummary } from '../api/finance';

/**
 * Renders a finance summary into a self-contained, print-ready HTML document.
 * Same philosophy as folioReceiptHtml: no external CSS/JS, system font stack
 * (Cyrillic-safe), A4-friendly. Consumed by expo-print (printAsync /
 * printToFileAsync) on the Finance screen's "Экспорт PDF".
 */
const money = (n: number) =>
  `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} TJS`;
const pct = (n: number) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('ru-RU')}%`;
const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');

function table(headers: string[], rows: (string | number)[][]): string {
  const head = headers.map((h) => `<th>${h}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? '' : 'num'}">${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="muted">Нет данных</td></tr>`}</tbody></table>`;
}

export function buildFinanceReportHtml(
  s: FinanceSummary,
  scope: 'all' | 'income' | 'expense' = 'all',
): string {
  const r = s.revenue;
  const delta = s.comparison.deltaPct;
  const wantIncome = scope !== 'expense';
  const wantExpense = scope !== 'income';
  const title =
    scope === 'income' ? 'Доходы' : scope === 'expense' ? 'Расходы' : 'Финансовый отчёт';

  const kpis = wantIncome
    ? `<div class="kpis">
    <div class="kpi"><div class="l">Чистая выручка</div><div class="v">${money(r.net)}</div></div>
    <div class="kpi"><div class="l">Прочие доходы</div><div class="v">${money(s.otherIncome.total)}</div></div>
    <div class="kpi"><div class="l">Совокупный доход</div><div class="v">${money(r.net + s.otherIncome.total)}</div></div>
    <div class="kpi"><div class="l">Δ к прошлому периоду</div><div class="v ${delta == null ? '' : delta >= 0 ? 'pos' : 'neg'}">${delta == null ? '—' : (delta >= 0 ? '+' : '') + pct(delta)}</div></div>
  </div>`
    : `<div class="kpis">
    <div class="kpi"><div class="l">Себестоимость</div><div class="v">${money(s.cogs.cost)}</div></div>
    <div class="kpi"><div class="l">Операционные затраты</div><div class="v">${money(s.expenses.total)}</div></div>
    <div class="kpi"><div class="l">Совокупные расходы</div><div class="v">${money(s.cogs.cost + s.expenses.total)}</div></div>
  </div>`;

  const incomeSections = wantIncome
    ? `
  <h2>Выручка по точкам</h2>
  ${table(['Точка', 'Сумма', 'Чеков'], r.byOutlet.map((o) => [o.label, money(o.amount), o.count]))}

  <h2>Способы оплаты</h2>
  ${table(['Способ', 'Сумма'], r.byPaymentMethod.map((p) => [p.label, money(p.amount)]))}

  <h2>Топ позиций</h2>
  ${table(['Позиция', 'Кол-во', 'Сумма'], r.byCategory.slice(0, 15).map((c) => [c.name, c.qty, money(c.amount)]))}

  <h2>Номера (ADR ${money(s.rooms.adr)} · RevPAR ${money(s.rooms.revpar)} · загрузка ${pct(s.rooms.occupancyRate)})</h2>
  ${table(['Тип', 'Выручка', 'Ночей', 'Броней'], s.rooms.byRoomType.map((t) => [t.name, money(t.revenue), t.nights, t.reservations]))}

  <h2>Прокат — всего ${money(s.rentals.revenue)}</h2>
  ${table(['Позиция', 'Выручка', 'Кол-во'], s.rentals.byItem.map((i) => [i.itemName, money(i.revenue), i.qty]))}

  <h2>Прочие доходы — всего ${money(s.otherIncome.total)}</h2>
  ${table(['Категория', 'Сумма', 'Кол-во'], s.otherIncome.byCategory.map((c) => [c.name, money(c.amount), c.count]))}`
    : '';

  const receivablesSection =
    scope === 'all'
      ? `
  <h2>Дебиторка — к оплате ${money(s.receivables.outstanding)} · оплачено ${money(s.receivables.paid)} · депозиты ${money(s.receivables.depositsHeld)}</h2>
  ${table(['Возраст', 'Сумма', 'Фолио'], s.receivables.aging.map((a) => [a.bucket, money(a.amount), a.count]))}`
      : '';

  const expenseSections = wantExpense
    ? `
  <h2>Себестоимость и маржа (товары)</h2>
  ${table(
    ['Показатель', 'Значение'],
    [
      ['Выручка товаров', money(s.cogs.goodsRevenue)],
      ['Себестоимость', money(s.cogs.cost)],
      ['Валовая прибыль', money(s.cogs.grossProfit)],
      ['Маржа', pct(s.cogs.marginPct)],
    ],
  )}

  <h2>Затраты — всего ${money(s.expenses.total)}</h2>
  ${table(['Категория', 'Сумма', 'Кол-во'], s.expenses.byCategory.map((c) => [c.name, money(c.amount), c.count]))}`
    : '';

  const pnlSection =
    scope === 'all'
      ? `
  <h2>Прибыль (P&amp;L)</h2>
  ${table(
    ['Показатель', 'Значение'],
    [
      ['Чистая выручка', money(r.net)],
      ['+ Прочие доходы', money(s.otherIncome.total)],
      ['− Себестоимость товаров', money(s.cogs.cost)],
      ['− Операционные затраты', money(s.expenses.total)],
      ['Чистая прибыль', money(s.profit.operatingProfit)],
      ['Рентабельность', pct(s.profit.marginPct)],
    ],
  )}`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111;padding:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:15px;margin:22px 0 6px;color:#1E3A8A}
  .muted{color:#777} .num{text-align:right;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
  th{background:#f4f6fb;font-weight:600}
  .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
  .kpi{flex:1;min-width:120px;border:1px solid #eee;border-radius:10px;padding:10px}
  .kpi .v{font-size:18px;font-weight:700} .kpi .l{color:#777;font-size:11px}
  .pos{color:#15803d} .neg{color:#b91c1c}
</style></head><body>
  <h1>${title} — Artuch</h1>
  <div class="muted">Период: ${date(s.range.from)} — ${date(s.range.to)}</div>
  ${kpis}
  ${incomeSections}
  ${receivablesSection}
  ${expenseSections}
  ${pnlSection}

  <p class="muted" style="margin-top:24px">Сформировано ${new Date().toLocaleString('ru-RU')}</p>
</body></html>`;
}
