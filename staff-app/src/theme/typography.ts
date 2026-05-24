/**
 * Typography tokens — "Mountain Dawn" type system.
 *
 * Two families (loaded in App.tsx via registerAppFont):
 *   - Onest      → UI / body / labels / titles  (sans)
 *   - Unbounded  → display, headlines, KPI numbers (expressive display)
 *
 * In React Native each weight is a SEPARATE family name (fontWeight doesn't
 * combine with custom fonts on iOS), so we map each MD3 variant to the exact
 * weighted family. `fontWeight` is kept for web/system fallback.
 *
 * Variant names match Paper's MD3 type variants so overrides pass straight
 * into the theme without renaming.
 */

// Sans (Onest) weights
const SANS = 'Onest';
const SANS_MEDIUM = 'Onest-Medium';
const SANS_SEMIBOLD = 'Onest-SemiBold';
// Display (Unbounded) weights
const DISPLAY = 'Unbounded-Bold';
const DISPLAY_SEMI = 'Unbounded-SemiBold';

/**
 * MD3 type scale, sized per the Mountain Dawn spec.
 * Display = hero numbers / KPI; Headline = section titles;
 * Title = card headers; Body = paragraph text; Label = chips / buttons.
 */
export const typeScale = {
  displayLarge: { fontFamily: DISPLAY, fontSize: 52, lineHeight: 56, fontWeight: '700' as const, letterSpacing: -0.5 },
  displayMedium: { fontFamily: DISPLAY, fontSize: 44, lineHeight: 48, fontWeight: '700' as const, letterSpacing: -0.5 },
  displaySmall: { fontFamily: DISPLAY, fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.25 },

  headlineLarge: { fontFamily: DISPLAY_SEMI, fontSize: 30, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.25 },
  headlineMedium: { fontFamily: DISPLAY_SEMI, fontSize: 24, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.15 },
  headlineSmall: { fontFamily: SANS_SEMIBOLD, fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.1 },

  titleLarge: { fontFamily: SANS_SEMIBOLD, fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0 },
  titleMedium: { fontFamily: SANS_SEMIBOLD, fontSize: 16, lineHeight: 22, fontWeight: '600' as const, letterSpacing: 0 },
  titleSmall: { fontFamily: SANS_SEMIBOLD, fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },

  bodyLarge: { fontFamily: SANS, fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.15 },
  bodyMedium: { fontFamily: SANS, fontSize: 14, lineHeight: 21, fontWeight: '400' as const, letterSpacing: 0.15 },
  bodySmall: { fontFamily: SANS, fontSize: 12, lineHeight: 17, fontWeight: '400' as const, letterSpacing: 0.2 },

  labelLarge: { fontFamily: SANS_SEMIBOLD, fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: SANS_MEDIUM, fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.4 },
  labelSmall: { fontFamily: SANS_MEDIUM, fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.6 },
} as const;

/** Font family constants for ad-hoc use (e.g. tabular KPI numbers). */
export const fontFamilies = {
  sans: SANS,
  sansMedium: SANS_MEDIUM,
  sansSemibold: SANS_SEMIBOLD,
  display: DISPLAY,
  displaySemi: DISPLAY_SEMI,
} as const;

export type TypographyVariant = keyof typeof typeScale;
