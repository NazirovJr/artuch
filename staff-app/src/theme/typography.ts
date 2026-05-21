/**
 * Typography tokens — Material 3 Expressive type scale.
 *
 * Uses system font today; will swap to Roboto Flex variable font in Phase 1.
 * Variant names match Paper's MD3 type variants so we can pass overrides
 * straight into the theme without renaming.
 */

const FONT_FAMILY_REGULAR = 'System';
const FONT_FAMILY_MEDIUM = 'System';

/**
 * MD3 Expressive type scale.
 * Display = hero numbers / KPI; Headline = section titles;
 * Title = card headers; Body = paragraph text; Label = chips / buttons.
 */
export const typeScale = {
  displayLarge: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 45, lineHeight: 52, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 36, lineHeight: 44, fontWeight: '400' as const, letterSpacing: 0 },

  headlineLarge: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 32, lineHeight: 40, fontWeight: '600' as const, letterSpacing: 0 },
  headlineMedium: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 28, lineHeight: 36, fontWeight: '600' as const, letterSpacing: 0 },
  headlineSmall: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: 0 },

  titleLarge: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: 0 },
  titleMedium: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleSmall: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },

  bodyLarge: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontFamily: FONT_FAMILY_REGULAR, fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },

  labelLarge: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
  labelSmall: { fontFamily: FONT_FAMILY_MEDIUM, fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
} as const;

export type TypographyVariant = keyof typeof typeScale;
