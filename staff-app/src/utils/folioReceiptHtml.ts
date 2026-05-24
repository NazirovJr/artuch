/**
 * Renders a hotel folio into a self-contained HTML string.
 *
 * The same markup is consumed in three places:
 *   - `FolioReceiptScreen` WebView preview (what staff sees on-device);
 *   - `expo-print.printAsync` / `printToFileAsync` for the system
 *     print-dialog + PDF generation;
 *   - `POST /v2/folios/:id/email-receipt` body (the backend sanitises then
 *     forwards verbatim — no re-render in Node).
 *
 * Design goals:
 *   - Self-contained (no external CSS/JS), A4-friendly, legible when
 *     printed on a thermal or office printer;
 *   - No custom web fonts — uses system stack so Cyrillic / Tajik renders
 *     everywhere WebView runs (iOS, Android, web);
 *   - All numbers formatted as integers where possible, two decimals for
 *     the total — avoids the ".0000001 TJS" that a raw decimal from the
 *     API would otherwise leak.
 *
 * Prefer constructing the args via `buildFolioReceiptArgs()` so the
 * caller doesn't have to massage API shapes — but the shape is kept
 * minimal so a bare object literal works too.
 */
import { HOTEL_INFO, type HotelInfo } from '../constants/hotel';
import { CHARGE_TYPE_LABELS as _CHARGE_TYPE_LABELS, esc as _esc, fmt as _fmt, fmtDate as _fmtDate, PDF_BASE_STYLES as _PDF_BASE_STYLES } from './pdfUtils';

export const CHARGE_TYPE_LABELS: Record<string, string> = {
  room: 'Проживание',
  restaurant: 'Ресторан',
  bar: 'Бар',
  shop: 'Магазин',
  rental: 'Прокат',
  service: 'Услуга',
  discount: 'Скидка',
  refund: 'Возврат',
  payment: 'Оплата',
  deposit: 'Депозит',
};

export interface ReceiptCharge {
  id?: string;
  chargeType: string;
  description: string;
  amount: number | string;
  createdAt?: string | Date;
}

export interface ReceiptFolio {
  id: string;
  status?: string;
  roomNumber?: number | null;
  openedAt?: string | Date;
  closedAt?: string | Date | null;
  totalAmount: number | string;
  paidAmount: number | string;
  notes?: string | null;
}

export interface ReceiptGuest {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  phone?: string | null;
  email?: string | null;
  passportNumber?: string | null;
}

export interface ReceiptReservation {
  checkInDate?: string | Date;
  checkOutDate?: string | Date;
  numberOfGuests?: number;
  reservationNumber?: number | string;
}

export interface RenderFolioReceiptArgs {
  folio: ReceiptFolio;
  charges: ReceiptCharge[];
  guest?: ReceiptGuest | null;
  reservation?: ReceiptReservation | null;
  hotel?: HotelInfo;
}

// ── helpers ─────────────────────────────────────────────────────────

const NBSP = '\u00A0';

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
  // Two decimals keep cents visible; grouping separator for readability.
  return v
    .toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\s/g, NBSP);
}

function guestName(g?: ReceiptGuest | null): string {
  if (!g) return '—';
  const full = `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim();
  return full || '—';
}

// ── main ────────────────────────────────────────────────────────────

export function renderFolioReceiptHtml(args: RenderFolioReceiptArgs): string {
  const hotel = args.hotel ?? HOTEL_INFO;
  const { folio, charges, guest, reservation } = args;

  const totalAmount = Number(folio.totalAmount) || 0;
  const paidAmount = Number(folio.paidAmount) || 0;
  const balance = totalAmount - paidAmount;

  // Sort oldest first so the bill reads top-to-bottom chronologically —
  // the natural "what happened first" order on a paper receipt.
  const rows = [...charges]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    })
    .map((c) => {
      const amt = Number(c.amount) || 0;
      const isCredit = amt < 0; // payments / deposits / discounts
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

  const issuedAt = fmtDateTime(folio.closedAt || new Date());
  const folioShort = esc(folio.id.slice(0, 8));

  // Header meta rows — hide empty fields so a sparse guest profile doesn't
  // leave dangling "—" lines.
  const metaRows: Array<[string, string]> = [];
  if (folio.roomNumber != null) metaRows.push(['Номер', `#${folio.roomNumber}`]);
  metaRows.push(['Гость', guestName(guest)]);
  if (guest?.phone) metaRows.push(['Телефон', guest.phone]);
  if (guest?.email) metaRows.push(['Email', guest.email]);
  if (guest?.passportNumber) metaRows.push(['Паспорт', guest.passportNumber]);
  if (reservation?.reservationNumber)
    metaRows.push(['Бронь', `#${reservation.reservationNumber}`]);
  if (reservation?.checkInDate && reservation?.checkOutDate) {
    metaRows.push([
      'Период',
      `${fmtDate(reservation.checkInDate)} — ${fmtDate(reservation.checkOutDate)}`,
    ]);
  }
  if (reservation?.numberOfGuests) {
    metaRows.push(['Гостей', String(reservation.numberOfGuests)]);
  }
  metaRows.push(['Открыт', fmtDateTime(folio.openedAt)]);
  if (folio.closedAt) metaRows.push(['Закрыт', fmtDateTime(folio.closedAt)]);

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

  const balanceClass = balance > 0 ? 'balance-due' : 'balance-paid';
  const balanceLabel = balance > 0 ? 'К оплате' : 'Оплачено полностью';

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Чек по фолио ${folioShort}</title>
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
      .receipt { max-width: 780px; margin: 0 auto; }
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
      header.hotel .tagline {
        font-size: 12px;
        color: #5F6368;
        margin-top: 4px;
      }
      header.hotel .contact {
        font-size: 11px;
        color: #5F6368;
        margin-top: 8px;
      }
      h1.title {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 4px;
      }
      .subtitle {
        font-size: 12px;
        color: #5F6368;
        margin-bottom: 16px;
      }
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
      table.charges {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      table.charges thead th {
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #5F6368;
        border-bottom: 1px solid #DADCE0;
        padding: 8px 6px;
      }
      table.charges tbody td {
        padding: 8px 6px;
        border-bottom: 1px solid #EEF0F3;
        font-size: 12px;
        vertical-align: top;
      }
      .cell-date { white-space: nowrap; color: #5F6368; width: 16%; }
      .cell-type { color: #5F6368; width: 12%; }
      .cell-desc { width: 52%; }
      .cell-amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 20%; font-weight: 600; }
      .cell-amt.debit { color: #1C1B1F; }
      .cell-amt.credit { color: #16A34A; }
      .totals {
        margin-top: 18px;
        border-top: 2px solid #1C1B1F;
        padding-top: 12px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        font-size: 13px;
      }
      .total-row.big {
        font-size: 16px;
        font-weight: 700;
        padding-top: 10px;
      }
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
      }
    </style>
  </head>
  <body>
    <div class="receipt">
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

      <h1 class="title">Чек по фолио №&nbsp;${folioShort}</h1>
      <div class="subtitle">Выписан: ${esc(issuedAt)}</div>

      <section class="meta">
        ${metaHtml}
      </section>

      <table class="charges">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Категория</th>
            <th>Описание</th>
            <th style="text-align:right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" style="text-align:center;color:#9AA0A6;padding:20px">Начислений нет</td></tr>`}
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

      ${folio.notes ? `<p style="margin-top:16px;font-size:12px;color:#5F6368"><em>${esc(folio.notes)}</em></p>` : ''}

      <footer>
        Спасибо, что выбрали ${esc(hotel.name)}! Хорошего пути.
      </footer>
    </div>
  </body>
</html>`;
}
