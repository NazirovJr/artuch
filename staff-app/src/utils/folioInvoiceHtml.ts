/**
 * Renders a hotel folio as a formal накладная (invoice/счёт).
 *
 * Layout matches the Artuch Travel sample invoice:
 *   - Header: logo (left) + company info (right)
 *   - "Счет № N" title
 *   - Guest info block (name, nationality, payment type, check-in/out)
 *   - Itemised table with quantity × unit price columns
 *   - Total row + "Итого получено" footer
 *   - Signature block (administrator + guest)
 *
 * Reuses pdfUtils for shared helpers; same expo-print/sharing pattern
 * as folioReceiptHtml.ts.
 */
import { HOTEL_INFO, type HotelInfo } from '../constants/hotel';
import { LOGO_BASE64 } from './logoBase64';
import { esc, fmt, fmtDate, fmtInt, PDF_BASE_STYLES, CHARGE_TYPE_LABELS } from './pdfUtils';

export interface InvoiceGuest {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  phone?: string;
  email?: string;
}

export interface InvoiceCharge {
  id?: string;
  chargeType: string;
  description: string;
  amount: number | string;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  createdAt?: string | Date;
}

export interface InvoiceLine {
  rowNumber: number;
  operation: string;
  roomLabel?: string;
  period?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceFolio {
  invoiceNumber?: number | null;
  roomNumber?: number | string | null;
  openedAt?: string | Date;
  closedAt?: string | Date | null;
  totalAmount: number | string;
  paidAmount: number | string;
  paymentType?: string;
}

export interface RenderInvoiceArgs {
  folio: InvoiceFolio;
  guest?: InvoiceGuest;
  lines: InvoiceLine[];
  administrator?: string;
  hotel?: Partial<HotelInfo>;
  /** Show "КОПИЯ" watermark on print */
  copy?: boolean;
}

const SKIP_TYPES = new Set(['payment', 'deposit', 'discount', 'refund']);

/** Convert raw folio charges into invoice line items. */
export function buildInvoiceLines(
  charges: InvoiceCharge[],
  folio: Pick<InvoiceFolio, 'roomNumber' | 'openedAt' | 'closedAt'>,
): InvoiceLine[] {
  let rowNumber = 0;
  return charges
    .filter((c) => !SKIP_TYPES.has(c.chargeType))
    .map((c) => {
      rowNumber += 1;
      const qty = c.quantity != null ? Number(c.quantity) : 1;
      const amount = Number(c.amount ?? 0);
      const uPrice = c.unitPrice != null ? Number(c.unitPrice) : amount / (qty || 1);
      const total = qty * uPrice;

      const isRoom = c.chargeType === 'room';
      const roomLabel = isRoom && folio.roomNumber ? String(folio.roomNumber) : undefined;
      const period =
        isRoom && folio.openedAt
          ? `${fmtDate(folio.openedAt)}${folio.closedAt ? ' — ' + fmtDate(folio.closedAt) : ''}`
          : undefined;

      const label = CHARGE_TYPE_LABELS[c.chargeType] ?? c.chargeType;
      const operation =
        c.description && c.description !== label ? c.description : label;

      return { rowNumber, operation, roomLabel, period, quantity: qty, unitPrice: uPrice, total };
    });
}

export function renderFolioInvoiceHtml(args: RenderInvoiceArgs): string {
  const { folio, guest, lines, administrator, copy = false } = args;
  const hotel: HotelInfo = { ...HOTEL_INFO, ...args.hotel };
  const currency = hotel.currency ?? 'TJS';

  const guestName =
    [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') || '—';
  const total = Number(folio.totalAmount ?? 0);
  const paid = Number(folio.paidAmount ?? 0);
  const balance = total - paid;
  const invoiceNo = folio.invoiceNumber ?? '';

  const logoSrc = hotel.logoUrl ?? LOGO_BASE64;

  const tableRows = lines.map(
    (l) => `
    <tr>
      <td style="text-align:center">${l.rowNumber}</td>
      <td>${esc(l.operation)}</td>
      <td style="text-align:center">${esc(l.roomLabel ?? '')}</td>
      <td style="text-align:center">${esc(l.period ?? '')}</td>
      <td style="text-align:center">${fmtInt(l.quantity)}</td>
      <td style="text-align:right">${fmtInt(l.unitPrice)}</td>
      <td style="text-align:right">${fmtInt(l.total)}</td>
    </tr>`,
  ).join('\n');

  const copyWatermark = copy ? `
    <style>
      @media print {
        body::after {
          content: 'КОПИЯ';
          position: fixed; top: 40%; left: 20%;
          font-size: 80px; font-weight: bold;
          color: rgba(0,0,0,0.08);
          transform: rotate(-30deg);
          pointer-events: none;
          z-index: 9999;
        }
      }
    </style>` : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Счет № ${invoiceNo}</title>
<style>
${PDF_BASE_STYLES}

.page { max-width: 800px; margin: 0 auto; padding: 24px; }

/* Header */
.header-table { width: 100%; border: none; margin-bottom: 24px; }
.header-table td { vertical-align: middle; border: none; }
.header-logo { width: 160px; }
.header-logo img { max-width: 150px; max-height: 80px; object-fit: contain; }
.header-company { text-align: center; }
.header-company .company-name { font-size: 16px; font-weight: bold; }
.header-company .company-detail { font-size: 11px; margin-top: 4px; }
.header-company a { color: #000; text-decoration: underline; }

/* Document title */
.doc-title { text-align: center; font-size: 15px; font-weight: bold; margin: 20px 0 16px; }

/* Guest block */
.guest-block { margin-bottom: 16px; font-size: 12px; }
.guest-block table { border: none; width: auto; }
.guest-block td { border: none; padding: 2px 8px 2px 0; }
.guest-label { font-weight: normal; }
.checkinout { display: flex; gap: 60px; margin-top: 2px; }

/* Items table */
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
.items-table th {
  background: #f5f5f5;
  border: 1px solid #000;
  padding: 5px 6px;
  text-align: center;
  font-weight: bold;
  white-space: nowrap;
}
.items-table td {
  border: 1px solid #000;
  padding: 5px 6px;
  vertical-align: middle;
}

/* Total */
.total-row { text-align: right; font-size: 12px; font-weight: bold; margin: 8px 0 16px; }

/* Итого footer */
.итого-line {
  font-size: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid #000;
  padding-bottom: 24px;
}

/* Signature */
.signatures { display: flex; justify-content: space-between; margin-top: 32px; font-size: 11px; }
.sig-block { flex: 1; }
.sig-block + .sig-block { margin-left: 40px; }
.sig-line { border-bottom: 1px solid #000; margin: 20px 0 4px; }
.sig-label { font-style: normal; }
</style>
${copyWatermark}
</head>
<body>
<div class="page">

  <!-- Header: logo left, company right -->
  <table class="header-table">
    <tr>
      <td class="header-logo">
        <img src="${logoSrc}" alt="${esc(hotel.name)}" />
      </td>
      <td class="header-company">
        <div class="company-name">${esc(hotel.name)}</div>
        <div class="company-detail">${esc(hotel.address ?? '')}</div>
        <div class="company-detail">
          тел.: ${esc(hotel.phone ?? '')}${hotel.email ? `, <a href="mailto:${esc(hotel.email)}">${esc(hotel.email)}</a>` : ''}
        </div>
        ${hotel.taxId ? `<div class="company-detail">ИНН: ${esc(hotel.taxId)}</div>` : ''}
      </td>
    </tr>
  </table>

  <!-- Document number -->
  <div class="doc-title">Счет № ${invoiceNo ? esc(String(invoiceNo)) : 'б/н'}</div>

  <!-- Guest info block -->
  <div class="guest-block">
    <table>
      <tr>
        <td class="guest-label">Гость:</td>
        <td><strong>${esc(guestName)}</strong></td>
      </tr>
      <tr>
        <td class="guest-label">Гражданство:</td>
        <td>${esc(guest?.nationality ?? '')}</td>
      </tr>
      <tr>
        <td class="guest-label">Тип оплаты:</td>
        <td>${esc(folio.paymentType ?? '')}</td>
      </tr>
    </table>
    <div class="checkinout">
      <span><strong>Заезд:</strong> ${fmtDate(folio.openedAt)}</span>
      ${folio.closedAt ? `<span><strong>Выезд:</strong> ${fmtDate(folio.closedAt)}</span>` : ''}
    </div>
  </div>

  <!-- Items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:36px">№</th>
        <th>Операция</th>
        <th style="width:100px">Номер<br/>комнаты</th>
        <th style="width:110px">Период<br/>оказания услуг</th>
        <th style="width:52px">Кол-во</th>
        <th style="width:64px">Цена,<br/>${esc(currency)}</th>
        <th style="width:70px">Сумма,<br/>${esc(currency)}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="7" style="text-align:center;padding:12px">Нет позиций</td></tr>`}
    </tbody>
  </table>

  <!-- Total -->
  <div class="total-row">Сумма(${esc(currency)}):&nbsp; ${fmtInt(total)}</div>

  <!-- Итого footer -->
  <div class="итого-line">
    Итого получено по счету:&nbsp; <strong>${fmtInt(paid)} ${esc(currency)}</strong>
    ${balance > 0.005 ? `&nbsp;|&nbsp; <span style="color:#c00">К оплате: ${fmt(balance)} ${esc(currency)}</span>` : ''}
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-label">Администратор:</div>
      <div class="sig-line"></div>
      <div>(Подпись)</div>
      ${administrator ? `<div style="margin-top:4px">${esc(administrator)}</div>` : '<div>(ФИО)</div>'}
    </div>
    <div class="sig-block" style="text-align:right">
      <div class="sig-label">Принял:</div>
      <div class="sig-line"></div>
      <div>(Подпись)</div>
      <div>(ФИО)</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
