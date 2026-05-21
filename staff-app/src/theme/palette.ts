/**
 * Brand palette — Fann Mountains "Calm Mountain" design language.
 *
 * MD3 primary/secondary are derived from `mountain` (deep blue, the colour of
 * the Fann lakes at dusk) and `sunset` (warm amber, the alpenglow on the
 * peaks). Status hues live in `colors.ts`; this module is only the brand.
 */

export const mountain = {
  /** Deepest blue — Light theme primary, surface accents */
  deep: '#1E3A8A',
  /** Mid blue — Dark theme primary, hover states */
  mid: '#3B82F6',
  /** Sky — tonal surface, highlights */
  sky: '#60A5FA',
  /** Glacier — outlines, dividers in light theme */
  glacier: '#CBD5E1',
  /** Snow — backgrounds */
  snow: '#F8FAFC',
} as const;

export const sunset = {
  /** Warm amber — secondary in both themes */
  warm: '#F59E0B',
  /** Lighter amber for dark theme */
  light: '#FBBF24',
} as const;

export const violet = {
  /** Tertiary — used for special chips (manager/owner, premium tags) */
  base: '#8B5CF6',
  light: '#A78BFA',
} as const;

/** Surface ladder used for elevation in dark theme (no shadows on dark BG) */
export const darkSurfaces = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  outline: '#475569',
  outlineVariant: '#334155',
} as const;

/** Surface ladder for light theme */
export const lightSurfaces = {
  background: mountain.snow,
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  outline: mountain.glacier,
  outlineVariant: '#E2E8F0',
} as const;

/**
 * Translucent overlay used over branded primary surfaces (drawer header,
 * onboarding splashes). Always white-ish so it stays legible on both light
 * and dark primary; the alpha lifts to ~contrast 4.5:1 against `mountain.deep`.
 */
export const onPrimaryOverlay = {
  /** Avatar / chip backdrop on primary surface */
  soft: 'rgba(255,255,255,0.2)',
  /** Secondary text on primary surface (caption, role name) */
  text: 'rgba(255,255,255,0.7)',
} as const;
