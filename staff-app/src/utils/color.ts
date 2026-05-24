/**
 * Tiny colour helpers for runtime tinting (status badges, soft fills).
 * Pure functions, no deps — safe to call in render.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** `#RRGGBB` → `rgba(r,g,b,a)`. Falls back to the input for non-hex values. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Relative luminance (0 dark … 1 light). */
export function luminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0.5;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

/** Mix a colour toward black by `amount` (0..1). Used to darken light hues. */
export function darken(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const f = 1 - amount;
  const to = (v: number) => Math.round(v * f);
  const h = (v: number) => to(v).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/**
 * Readable foreground for a soft-tinted badge: keep the hue but darken
 * light colours (e.g. amber) so text stays legible on its own light tint.
 */
export function readableInk(color: string): string {
  return luminance(color) > 0.62 ? darken(color, 0.42) : color;
}
