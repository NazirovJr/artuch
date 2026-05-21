/**
 * Input masks — apply via TextInput.onChangeText to auto-format value
 * as the user types. Each mask is idempotent: feeding its own output
 * back returns the same string, so React's controlled-input loop
 * (`value={state}` + `onChangeText={(v) => setState(maskX(v))}`) is safe.
 *
 * Why no external library: project doesn't use `react-native-mask-text`
 * or `imask`, and these three masks are simple enough that the cost of
 * an extra dependency outweighs the benefit. If we ever add 5+ masks,
 * reconsider.
 */

/**
 * `YYYY-MM-DD` mask. Strips non-digits, caps at 8 digits, then inserts
 * dashes at positions 4 and 6.
 *
 * Examples:
 *   maskDate('20260403') → '2026-04-03'
 *   maskDate('2026-04-03') → '2026-04-03'  (idempotent)
 *   maskDate('2026') → '2026'
 *   maskDate('20260') → '2026-0'
 */
export function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * International phone mask. Targets Tajikistan format `+992 XXX XX-XX-XX`,
 * but works for any country code (3 leading digits → "+CCC", then groups).
 *
 * Examples:
 *   maskPhone('992978234444') → '+992 978 23-44-44'
 *   maskPhone('+992 978 234444') → '+992 978 23-44-44'  (idempotent)
 *   maskPhone('992') → '+992'
 *   maskPhone('') → ''
 */
export function maskPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  let out = `+${digits.slice(0, 3)}`;
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += ` ${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  if (digits.length > 10) out += `-${digits.slice(10, 12)}`;
  return out;
}

/**
 * Money mask: thousands separator (regular space) + 2 decimal places max.
 *
 * Apply on `onBlur`, NOT `onChangeText` — formatting digits while the
 * cursor is mid-string causes caret jumps. During typing keep the value
 * raw (use `moneyInputFilter` to strip illegal chars), then format on blur.
 *
 * Examples:
 *   maskMoney('1000') → '1 000'
 *   maskMoney('1000.5') → '1 000.50'
 *   maskMoney('1000.567') → '1 000.56'
 *   maskMoney('') → ''
 */
export function maskMoney(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const [intPart = '', decPart] = cleaned.split('.');
  const withSpaces = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (decPart === undefined) return withSpaces;
  // Pad to 2 decimals, truncate to 2.
  const dec = (decPart + '00').slice(0, 2);
  return `${withSpaces}.${dec}`;
}

/**
 * Filter to use in `onChangeText` for money fields — keeps the input raw
 * (no thousand separators), but blocks letters and stray dots. The full
 * `maskMoney` formatter runs on `onBlur`.
 */
export function moneyInputFilter(input: string): string {
  // Keep digits and at most one dot.
  const cleaned = input.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

/** Strip everything except digits — useful before sending phone/date to API. */
export const unmaskDigits = (input: string): string => input.replace(/\D/g, '');

/** Strip thousand-separator spaces — useful before parseFloat on money. */
export const unmaskMoney = (input: string): string => input.replace(/\s/g, '');
