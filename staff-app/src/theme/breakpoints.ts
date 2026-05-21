/**
 * Breakpoints — responsive layout thresholds aligned with Material Design 3.
 *
 *   phone    <600   compact   — handheld, portrait phones
 *   tablet   600+   medium    — phone landscape, tablet portrait
 *   desktop  840+   expanded  — tablet landscape, small desktops
 *   wide     1200+  large     — full desktop, web on monitor
 *
 * Use via `useBreakpoint()` (reactive — survives orientation changes and
 * window resize on web/tablet) plus `rv()` to express per-breakpoint values.
 */
export const breakpoints = {
  phone: 0,
  tablet: 600,
  desktop: 840,
  wide: 1200,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Ordered from widest to narrowest — used for fallback resolution in `rv()`. */
export const breakpointOrder: readonly Breakpoint[] = ['wide', 'desktop', 'tablet', 'phone'];

/** Centred max content widths for ScreenContainer & form bodies. */
export const contentMaxWidth = {
  reading: 720,
  grid: 1400,
  full: undefined,
} as const;

export type ContentWidth = keyof typeof contentMaxWidth;
