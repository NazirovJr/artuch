/**
 * Brand palette — "Mountain Dawn" design language (от claude design).
 *
 * Two complete token sets — `dawnLight` and `dawnDark` — drive the MD3 themes
 * in `index.ts`. Everything (surfaces, ink, primary/accent + variants, soft
 * semantic backgrounds, gradients) lives here as the single source of truth.
 *
 * Light = warm snow + graphite-blue "Mountain Night" + amber "Sunrise".
 * Dark  = deep night blue, accent-forward (primary becomes warm amber).
 *
 * Legacy aliases (`mountain`, `sunset`, `violet`, `lightSurfaces`,
 * `darkSurfaces`, `onPrimaryOverlay`) are kept for back-compat with existing
 * imports — remapped onto the new values.
 */

// ─── Mountain Dawn · LIGHT ──────────────────────────────────────
export const dawnLight = {
  // Surfaces — warm, snow-leaning
  bg: '#F4EEE2',
  bg2: '#EFE7D6',
  surface: '#FFFFFF',
  surface2: '#FBF7EF',
  surface3: '#F1EADC',
  surfaceSunken: '#EBE3D2',

  // Borders
  border: '#E4DAC4',
  borderStrong: '#C9BCA0',
  divider: 'rgba(27,36,51,0.08)',

  // Ink — graphite blue
  text: '#1B2433',
  text2: '#4A5567',
  text3: '#8B93A1',
  textInverse: '#FFFFFF',

  // Primary — Mountain Night
  primary: '#2A3A4F',
  primaryHover: '#344558',
  primaryPressed: '#1F2C3C',
  onPrimary: '#FFFFFF',
  primarySoft: '#DDE4EE',
  primarySoft2: '#C5D0E0',
  onPrimarySoft: '#1B2433',

  // Accent — Amber Sunrise
  accent: '#E8A04A',
  accentHover: '#EFAE60',
  accentPressed: '#D08A38',
  onAccent: '#1B2433',
  accentSoft: '#FAE6C5',
  accentSoft2: '#F4D29B',
  onAccentSoft: '#6A4012',

  // Semantics
  success: '#2F6E48',
  successSoft: '#D9EBDF',
  onSuccess: '#FFFFFF',
  warning: '#C97A1E',
  warningSoft: '#FBE5C6',
  onWarning: '#FFFFFF',
  error: '#B84A3E',
  errorSoft: '#F4D7D2',
  onError: '#FFFFFF',
  info: '#3A6493',
  infoSoft: '#D6E1EE',
  onInfo: '#FFFFFF',

  // Gradients — hero surfaces only
  gradientDawn: ['#2A3A4F', '#5C5670', '#C97A4A', '#F0B968'] as const,
  gradientDawn2: ['#F4D29B', '#E8A04A', '#B26A2A'] as const,
  gradientNight: ['#0E1623', '#1A2540', '#3A2E1E'] as const,
} as const;

// ─── Mountain Dawn · DARK (bar / night) ─────────────────────────
export const dawnDark = {
  bg: '#0C1421',
  bg2: '#131D2E',
  surface: '#182335',
  surface2: '#1F2C42',
  surface3: '#283651',
  surfaceSunken: '#0E1729',

  border: '#2C3A55',
  borderStrong: '#4A5A78',
  divider: 'rgba(240,233,220,0.10)',

  text: '#F0E9DC',
  text2: '#B8C0CC',
  text3: '#7C8595',
  textInverse: '#1B2433',

  // Primary — accent-forward in dark
  primary: '#F0B968',
  primaryHover: '#F5C887',
  primaryPressed: '#D7A153',
  onPrimary: '#1B2433',
  primarySoft: '#3A2E1E',
  primarySoft2: '#54421F',
  onPrimarySoft: '#F0B968',

  accent: '#E8A04A',
  accentHover: '#F0B260',
  accentPressed: '#D08A38',
  onAccent: '#1B2433',
  accentSoft: '#3A2E1E',
  accentSoft2: '#54421F',
  onAccentSoft: '#F4D29B',

  success: '#6CAE82',
  successSoft: '#1E3526',
  onSuccess: '#0C1421',
  warning: '#F0B968',
  warningSoft: '#3A2E1E',
  onWarning: '#1B2433',
  error: '#E07466',
  errorSoft: '#3A1F1B',
  onError: '#FFFFFF',
  info: '#7AA0CC',
  infoSoft: '#1B2A40',
  onInfo: '#0C1421',

  gradientDawn: ['#0E1623', '#2A2540', '#54421F', '#C97A1E'] as const,
  gradientDawn2: ['#54421F', '#C97A1E', '#6A4012'] as const,
  gradientNight: ['#0C1421', '#1A2540'] as const,
} as const;

/** Widened so both `dawnLight` and `dawnDark` (different literals) are assignable. */
export type DawnTokens = {
  readonly [K in keyof typeof dawnLight]: (typeof dawnLight)[K] extends readonly string[]
    ? readonly string[]
    : string;
};

// ─── Legacy aliases (back-compat) ───────────────────────────────
/** @deprecated use dawnLight/dawnDark tokens via theme.brand.tokens */
export const mountain = {
  deep: dawnLight.primary,
  mid: dawnDark.primary,
  sky: dawnLight.accent,
  glacier: dawnLight.border,
  snow: dawnLight.bg,
} as const;

/** @deprecated use accent tokens */
export const sunset = {
  warm: dawnLight.accent,
  light: dawnDark.primary,
} as const;

/** @deprecated tertiary kept for role chips */
export const violet = {
  base: '#8B5CF6',
  light: '#A78BFA',
} as const;

export const darkSurfaces = {
  background: dawnDark.bg,
  surface: dawnDark.surface,
  surfaceVariant: dawnDark.surface3,
  outline: dawnDark.borderStrong,
  outlineVariant: dawnDark.border,
} as const;

export const lightSurfaces = {
  background: dawnLight.bg,
  surface: dawnLight.surface,
  surfaceVariant: dawnLight.surface3,
  outline: dawnLight.border,
  outlineVariant: dawnLight.divider,
} as const;

/**
 * Translucent overlay over branded primary surfaces (drawer header, splashes).
 * Primary is dark in light theme → white overlay stays legible.
 */
export const onPrimaryOverlay = {
  soft: 'rgba(255,255,255,0.2)',
  text: 'rgba(255,255,255,0.7)',
} as const;
