/**
 * `rv` — Responsive Value resolver.
 *
 * Pick the value matching the current breakpoint, falling back to the next
 * narrower one if a key is omitted. Mirrors the `<Box flexDirection={{ phone:
 * 'column', tablet: 'row' }} />` ergonomics from Shopify Restyle, but as a
 * plain function so we don't need to wrap every component.
 *
 *   const cols = rv({ phone: 2, tablet: 3, desktop: 4 }, bp);
 *
 * `phone` is required — it's the smallest breakpoint and the universal
 * fallback. Omitting it would produce `undefined` for narrow screens.
 */
import type { Breakpoint } from '../theme/breakpoints';

export type ResponsiveValue<T> = { phone: T } & Partial<Record<Exclude<Breakpoint, 'phone'>, T>>;

/** Order from widest → narrowest. We walk this until we find a defined key. */
const FALLBACK_ORDER: readonly Breakpoint[] = ['wide', 'desktop', 'tablet', 'phone'];

export function rv<T>(values: ResponsiveValue<T>, bp: Breakpoint): T {
  const start = FALLBACK_ORDER.indexOf(bp);
  for (let i = start; i < FALLBACK_ORDER.length; i++) {
    const key = FALLBACK_ORDER[i];
    const value = values[key];
    if (value !== undefined) return value;
  }
  // `phone` is required by the type so this is unreachable in well-typed code.
  return values.phone;
}
