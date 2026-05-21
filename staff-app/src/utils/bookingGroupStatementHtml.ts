/**
 * Renders a booking-group master statement into a self-contained HTML
 * document. Same delivery story as `folioReceiptHtml.ts`:
 *   - WebView preview in the staff-app;
 *   - `expo-print.printAsync` / `printToFileAsync` for PDF;
 *   - body of an email-statement endpoint (when added).
 *
 * The wire format is the structure returned by
 * `GET /booking-groups/:id/statement` — server does the math, client
 * just lays it out.
 */
import { HOTEL_INFO, type HotelInfo } from '../constants/hotel';
import { CHARGE_TYPE_LABELS } from './folioReceiptHtml';

export interface StatementCharge {
  id?: string;
  chargeType: string;
  description: string;
  amount: number | string;
  createdAt?: string | Date;
}

export interface StatementReservation {
  id: string;
  reservationNumber?: number | string;
  roomNumber: number;
  checkInDate?: string | Date;
  checkOutDate?: string | Date;
  numberOfGuests?: number;
  status?: string;
  totalPrice: number | string;
  guest?: { firstName?: string; lastName?: string } | null;
}

export interface StatementGroup {
  id: string;
  code: string;
  name: string;
  organization?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  leaderGuest?: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  status: string;
  discountPercent?: number | null;
  notes?: string | null;
  routeAllToMaster?: boolean;
}

export interface StatementFolio {
  id: string;
  totalAmount: number | string;
  paidAmount: number | string;
  balance: number | string;
  openedAt?: string | Date | null;
  closedAt?: string | Date | null;
  charges: StatementCharge[];
  byType?: Record<string, number>;
}

export interface RenderStatementArgs {
  group: StatementGroup;
  reservations: StatementReservation[];
  folio: StatementFolio | null;
  issuedAt?: string | Date;
  hotel?: HotelInfo;
}

const NBSP = ' ';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    const x = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(x.getTime())) return String(d);
    return x.toLocaleDateString('ru-RU');
  } catch {
    return String(d);
  }
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    const x = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(x.getTime())) return String(d);
    return x.toLocaleString('ru-RU');
  } catch {
    return String(d);
  }
}

function fmtMoney(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return v
    .toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\s/g, NBSP);
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  active: 'Активна',
  closed: 'Закрыта',
  cancelled: 'Отменена',
  confirmed: 'Подтверждена',
  'checked-in': 'Заселён',
  'checked-out': 'Выселен',
};

export function renderBookingGroupStatementHtml(
  args: RenderStatementArgs,
): string {
  const hotel = args.hotel ?? HOTEL_INFO;
  const { group, reservations, folio } = args;
  const issuedAt = fmtDateTime(args.issuedAt ?? new Date());

  const totalAmount = Number(folio?.totalAmount) || 0;
  const paidAmount = Number(folio?.paidAmount) || 0;
  const balance =
    folio?.balance != null ? Number(folio.balance) : totalAmount - paidAmount;

  // ── Group meta block ───────────────────────────────────────────
  const metaRows: Array<[string, string]> = [];
  metaRows.push(['Код группы', group.code]);
  metaRows.push(['Статус', STATUS_LABEL[group.status] ?? group.status]);
  if (group.organization) metaRows.push(['Организация', group.organization]);
  if (group.contactName) metaRows.push(['Контакт', group.contactName]);
  if (group.contactPhone) metaRows.push(['Телефон', group.contactPhone]);
  if (group.contactEmail) metaRows.push(['Email', group.contactEmail]);
  if (group.leaderGuest) {
    const ln = `${group.leaderGuest.firstName ?? ''} ${group.leaderGuest.lastName ?? ''}`.trim();
    if (ln) metaRows.push(['Лидер группы', ln]);
  }
  if (group.checkInDate && group.checkOutDate) {
    metaRows.push([
      'Период',
      `${fmtDate(group.checkInDate)} — ${fmtDate(group.checkOutDate)}`,
    ]);
  }
  if (group.discountPercent != null && Number(group.discountPercent) > 0) {
    metaRows.push(['Скидка группе', `${group.discountPercent}%`]);
  }
  if (folio?.openedAt) metaRows.push(['Счёт открыт', fmtDateTime(folio.openedAt)]);
  if (folio?.closedAt) metaRows.push(['Счёт закрыт', fmtDateTime(folio.closedAt)]);

  const metaHtml = metaRows
    .map(
      ([k, v]) => `
      <div class="meta-row">
        <span class="meta-key">${esc(k)}</span>
        <span class="meta-val">${esc(v)}</span>
      </div>
    `,
    )
    .join('');

  // ── Rooms block ────────────────────────────────────────────────
  const roomsRows = reservations
    .map((r) => {
      const guestName = r.guest
        ? `${r.guest.firstName ?? ''} ${r.guest.lastName ?? ''}`.trim()
        : '—';
      const dates =
        r.checkInDate && r.checkOutDate
          ? `${fmtDate(r.checkInDate)} — ${fmtDate(r.checkOutDate)}`
          : '—';
      return `
        <tr>
          <td>${esc(`#${r.roomNumber}`)}</td>
          <td>${esc(guestName || '—')}</td>
          <td>${esc(dates)}</td>
          <td style="text-align:center">${esc(r.numberOfGuests ?? '—')}</td>
          <td>${esc(STATUS_LABEL[r.status ?? ''] ?? r.status ?? '—')}</td>
          <td class="cell-amt">${fmtMoney(r.totalPrice)}${NBSP}TJS</td>
        </tr>
      `;
    })
    .join('');

  // ── Charges block ──────────────────────────────────────────────
  const chargeRows = (folio?.charges ?? [])
    .map((c) => {
      const amt = Number(c.amount) || 0;
      const isCredit = amt < 0;
      const amountText = (isCredit ? '' : '+') + fmtMoney(amt);
      return `
        <tr>
          <td class="cell-date">${esc(fmtDateTime(c.createdAt))}</td>
          <td class="cell-type">${esc(CHARGE_TYPE_LABELS[c.chargeType] ?? c.chargeType)}</td>
          <td class="cell-desc">${esc(c.description)}</td>
          <td class="cell-amt ${isCredit ? 'credit' : 'debit'}">${amountText}${NBSP}TJS</td>
        </tr>
      `;
    })
    .join('');

  const balanceClass = balance > 0 ? 'balance-due' : 'balance-paid';
  const balanceLabel = balance > 0 ? 'К оплате' : 'Оплачено полностью';
  const codeShort = esc(group.code);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Счёт группы ${codeShort}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #1C1B1F;
        background: #FFFFFF;
        line-height: 1.45;
        font-size: 13px;
      }
      .statement { max-width: 820px; margin: 0 auto; }
      header.hotel {
        text-align: center;
        padding-bottom: 20px;
        border-bottom: 2px solid #1E3A8A;
        margin-bottom: 20px;
      }
      header.hotel .name {
        font-size: 26px;
        font-weight: 700;
        color: #1E3A8A;
        letter-spacing: 0.5px;
      }
      header.hotel .tagline { font-size: 12px; color: #5F6368; margin-top: 4px; }
      header.hotel .contact { font-size: 11px; color: #5F6368; margin-top: 8px; }
      h1.title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      h2.section { font-size: 14px; font-weight: 700; margin: 22px 0 8px; color: #1E3A8A; }
      .subtitle { font-size: 12px; color: #5F6368; margin-bottom: 16px; }
      .group-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 24px;
        margin-bottom: 18px;
        background: #F7F7FB;
        border-radius: 6px;
        padding: 12px 16px;
      }
      .meta-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
      .meta-key { color: #5F6368; }
      .meta-val { color: #1C1B1F; font-weight: 500; }
      table { width: 100%; border-collapse: collapse; }
      thead th {
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #5F6368;
        border-bottom: 1px solid #DADCE0;
        padding: 8px 6px;
      }
      tbody td {
        padding: 8px 6px;
        border-bottom: 1px solid #EEF0F3;
        font-size: 12px;
        vertical-align: top;
      }
      .cell-date { white-space: nowrap; color: #5F6368; width: 16%; }
      .cell-type { color: #5F6368; width: 12%; }
      .cell-desc { width: 52%; }
      .cell-amt {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .cell-amt.debit { color: #1C1B1F; }
      .cell-amt.credit { color: #16A34A; }
      .totals { margin-top: 18px; border-top: 2px solid #1C1B1F; padding-top: 12px; }
      .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
      .total-row.big { font-size: 16px; font-weight: 700; padding-top: 10px; }
      .total-row.big.balance-due .value { color: #DC2626; }
      .total-row.big.balance-paid .value { color: #16A34A; }
      .value { font-variant-numeric: tabular-nums; }
      footer {
        margin-top: 28px;
        text-align: center;
        font-size: 11px;
        color: #5F6368;
        border-top: 1px dashed #DADCE0;
        padding-top: 16px;
      }
      @media print {
        body { padding: 8mm; font-size: 11px; }
        h2.section { page-break-after: avoid; }
        tr { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="statement">
      <header class="hotel">
        <div class="name">${esc(hotel.name)}</div>
        ${hotel.tagline ? `<div class="tagline">${esc(hotel.tagline)}</div>` : ''}
        <div class="contact">
          ${[hotel.address, hotel.phone, hotel.email, hotel.website]
            .filter(Boolean)
            .map(esc)
            .join('&nbsp;&nbsp;·&nbsp;&nbsp;')}
          ${hotel.taxId ? `&nbsp;&nbsp;·&nbsp;&nbsp;ИНН ${esc(hotel.taxId)}` : ''}
        </div>
      </header>

      <h1 class="title">Счёт группы ${codeShort}</h1>
      <div class="group-name">${esc(group.name)}</div>
      <div class="subtitle">Выписан: ${esc(issuedAt)}</div>

      <section class="meta">
        ${metaHtml}
      </section>

      <h2 class="section">Комнаты в группе (${reservations.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Номер</th>
            <th>Гость</th>
            <th>Период</th>
            <th style="text-align:center">Гостей</th>
            <th>Статус</th>
            <th style="text-align:right">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          ${
            roomsRows ||
            `<tr><td colspan="6" style="text-align:center;color:#9AA0A6;padding:20px">В группе нет комнат</td></tr>`
          }
        </tbody>
      </table>

      <h2 class="section">Начисления и оплаты</h2>
      <table>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Категория</th>
            <th>Описание</th>
            <th style="text-align:right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${
            chargeRows ||
            `<tr><td colspan="4" style="text-align:center;color:#9AA0A6;padding:20px">Начислений нет</td></tr>`
          }
        </tbody>
      </table>

      <section class="totals">
        <div class="total-row">
          <span>Начислено</span>
          <span class="value">${fmtMoney(totalAmount)}${NBSP}TJS</span>
        </div>
        <div class="total-row">
          <span>Оплачено</span>
          <span class="value">${fmtMoney(paidAmount)}${NBSP}TJS</span>
        </div>
        <div class="total-row big ${balanceClass}">
          <span>${esc(balanceLabel)}</span>
          <span class="value">${fmtMoney(Math.abs(balance))}${NBSP}TJS</span>
        </div>
      </section>

      ${group.notes ? `<p style="margin-top:16px;font-size:12px;color:#5F6368"><em>${esc(group.notes)}</em></p>` : ''}

      <footer>
        Спасибо, что выбрали ${esc(hotel.name)}! Хорошего пути.
      </footer>
    </div>
  </body>
</html>`;
}
