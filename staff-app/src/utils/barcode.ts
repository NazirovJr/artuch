/**
 * Frontend mirror of the backend `normalizeBarcode` (backend/src/common/
 * barcode.ts). Used for instant client-side matching against the loaded
 * inventory so a scan resolves without a round-trip; the server applies the
 * authoritative normalization on the fallback lookup and on every write, so
 * stored `item.barcode` values are already normalized.
 *
 * Drops control / zero-width code points, collapses whitespace, uppercases.
 * Leading zeros are preserved (EAN/UPC identity).
 */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (raw == null) return '';
  let out = '';
  for (const ch of String(raw)) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || cp === 0x7f) continue;
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff) continue;
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().toUpperCase();
}
