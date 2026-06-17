/**
 * Barcode normalization — the single source of truth applied on BOTH write
 * (item create/update) and read (scan lookup), so a code stored from a manual
 * entry always matches the same code arriving from a USB/Bluetooth scanner.
 *
 * Scanners (HID keyboard-wedge) frequently append CR/LF/Tab and may emit
 * stray whitespace; copy-paste adds non-breaking / zero-width spaces. We drop
 * control chars and zero-width code points, collapse inner whitespace, and
 * uppercase so alphanumeric codes compare case-insensitively. We deliberately
 * do NOT strip leading zeros or re-encode EAN/UPC — that changes the code's
 * identity.
 */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (raw == null) return '';
  let out = '';
  for (const ch of String(raw)) {
    const cp = ch.codePointAt(0)!;
    // Drop C0/C1 control chars (< 0x20, 0x7F) and zero-width / BOM marks.
    if (cp < 0x20 || cp === 0x7f) continue;
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff) continue;
    out += ch;
  }
  // Collapse any remaining whitespace (incl. NBSP, which \s matches) and trim.
  return out.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** True when the value is empty after normalization (treat as "no barcode"). */
export function isBlankBarcode(raw: string | null | undefined): boolean {
  return normalizeBarcode(raw).length === 0;
}

/**
 * Deterministic internal barcode for an item that lacks a manufacturer code,
 * so it can still get a printed, scannable label. Format: `ART` + the item's
 * UUID head as 10 hex digits → stable, collision-free per item, Code128-safe.
 */
export function generateInternalBarcode(itemId: string): string {
  const hex = String(itemId)
    .replace(/[^a-fA-F0-9]/g, '')
    .slice(0, 10)
    .toUpperCase();
  return `ART${hex.padStart(10, '0')}`;
}
