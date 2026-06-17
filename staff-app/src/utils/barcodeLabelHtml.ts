/**
 * Printable barcode-label sheet (HTML → expo-print). Self-contained: the
 * Code128 is drawn as inline SVG (see code128.ts), so labels print offline
 * and inside the Windows .exe with no CDN/font dependency.
 *
 * Same delivery pattern as the folio receipt/invoice PDFs: a template fn
 * returns an HTML string the caller hands to `Print.printAsync({ html })`.
 */
import { code128Svg } from './code128';
import { normalizeBarcode, generateInternalBarcode } from './barcode';

export interface LabelItem {
  id: string;
  name: string;
  price?: number | null;
  barcode?: string | null;
  /** How many copies of this label to print. */
  copies?: number;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Code shown/encoded for an item: its barcode, else a generated internal one. */
export function labelCodeFor(item: Pick<LabelItem, 'id' | 'barcode'>): string {
  const code = normalizeBarcode(item.barcode);
  return code || generateInternalBarcode(item.id);
}

function labelCell(item: LabelItem): string {
  const code = labelCodeFor(item);
  const svg = code128Svg(code, { moduleWidth: 1.5, height: 48 });
  const price =
    item.price != null && !Number.isNaN(Number(item.price))
      ? `<div class="price">${Number(item.price).toFixed(2)} TJS</div>`
      : '';
  return `
    <div class="label">
      <div class="name">${esc(item.name)}</div>
      ${price}
      <div class="bc">${svg}</div>
      <div class="code">${esc(code)}</div>
    </div>`;
}

/**
 * Build the full label sheet. Each item is repeated `copies` times (default 1).
 * Labels flow in a wrapping grid sized for a standard A4 print or a label roll
 * (the browser/print dialog handles paper choice).
 */
export function renderBarcodeLabelsHtml(items: LabelItem[]): string {
  const cells: string[] = [];
  for (const item of items) {
    const n = Math.max(1, Math.floor(item.copies ?? 1));
    for (let i = 0; i < n; i++) cells.push(labelCell(item));
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 8px; font-family: Arial, Helvetica, sans-serif; }
  .sheet { display: flex; flex-wrap: wrap; gap: 8px; }
  .label {
    width: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;
    text-align: center; page-break-inside: avoid; break-inside: avoid;
  }
  .name { font-size: 13px; font-weight: 700; line-height: 1.2; min-height: 32px;
          overflow: hidden; }
  .price { font-size: 13px; font-weight: 700; margin: 2px 0 4px; }
  .bc { display: flex; justify-content: center; }
  .bc svg { width: 100%; height: 48px; }
  .code { font-size: 11px; letter-spacing: 1px; margin-top: 2px; font-family: monospace; }
  @media print { .label { border-color: #000; } }
</style>
</head>
<body><div class="sheet">${cells.join('')}</div></body>
</html>`;
}
