/**
 * Shape tokens — Material 3 Expressive radius system.
 *
 * MD3 Expressive emphasises *shape contrast*: pair small/round (chips, buttons)
 * with larger/squarer surfaces (sheets, cards) so hierarchy reads at a glance.
 * Use `full` for pill/circular shapes; `xl` for sheets/dialogs; `md` for cards.
 */

export const radius = {
  /** 4 — minimal rounding (badges, dividers) */
  xs: 4,
  /** 8 — buttons, chips, small inputs */
  sm: 8,
  /** 12 — cards, list items (default for surfaces) */
  md: 12,
  /** 16 — prominent cards */
  lg: 16,
  /** 20 — bento KPI tiles */
  bento: 20,
  /** 24 — sheets, dialogs, FABs */
  xl: 24,
  /** 32 — hero cards, large sheets */
  xxl: 32,
  /** 999 — pill / circular (avatars, status pills) */
  full: 999,
} as const;

/**
 * Per-component shape mapping — pulled into MD3 theme.roundness defaults
 * via the helper used in `theme/index.ts`.
 */
export const componentShape = {
  card: radius.md,
  cardLarge: radius.lg,
  button: radius.sm,
  buttonLarge: radius.md,
  fab: radius.xl,
  dialog: radius.xl,
  sheet: radius.xl,
  chip: radius.full,
  input: radius.sm,
} as const;

export type RadiusToken = keyof typeof radius;
