/**
 * Shared utilities for all PDF/print HTML templates.
 * Extracted from folioReceiptHtml.ts to avoid duplication.
 */

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

/** HTML-escape a value for safe inline insertion. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Format a decimal number to 2 decimal places. */
export const fmt = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toFixed(2);

/** Format an integer-safe number (no trailing .00 if whole number). */
export const fmtInt = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/** Format a date string/Date to DD.MM.YYYY */
export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return String(d);
  }
};

/** A4-friendly CSS reset for all PDF templates. */
export const PDF_BASE_STYLES = `
  @page { size: A4 portrait; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: #000;
    background: #fff;
  }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;
