/**
 * Theme entry — composes light/dark MD3 themes from the "Mountain Dawn"
 * token sets in `palette.ts`.
 *
 * Brand colours / surfaces / gradients live in `palette.ts` (dawnLight /
 * dawnDark); status colours in `colors.ts`; timing in `motion.ts`; corner
 * radii in `shape.ts`; type scale in `typography.ts`.
 *
 * Anything that is *not* a Paper MD3 token is exposed via the `brand`
 * namespace on the theme so screens pull it through `useAppTheme()` with full
 * TS autocomplete:
 *
 *   const t = useAppTheme();
 *   t.brand.tokens.surface2      // warm raised surface
 *   t.brand.tokens.accentSoft    // soft amber fill
 *   t.brand.tokens.gradientDawn  // hero gradient (string[])
 *   t.brand.semanticSoft.success // {bg, fg} badge pair
 *   t.brand.shadows.lg           // RN shadow style
 */
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import {
  mountain,
  sunset,
  violet,
  dawnLight,
  dawnDark,
  type DawnTokens,
} from './palette';
import { semanticSoft } from './colors';
import { typeScale } from './typography';
import { radius, componentShape } from './shape';
import { duration, easing, spring } from './motion';
import { spacing, shadows } from './spacing';

export { spacing, borderRadius, shadows } from './spacing';
export * from './colors';
export * from './palette';
export * from './motion';
export * from './shape';
export * from './typography';

const fonts = configureFonts({ config: typeScale });

/** Build a Paper MD3 theme from a Mountain Dawn token set. */
function buildColors(t: DawnTokens, base: typeof MD3LightTheme.colors) {
  return {
    ...base,
    primary: t.primary,
    onPrimary: t.onPrimary,
    primaryContainer: t.primarySoft,
    onPrimaryContainer: t.onPrimarySoft,

    secondary: t.accent,
    onSecondary: t.onAccent,
    secondaryContainer: t.accentSoft,
    onSecondaryContainer: t.onAccentSoft,

    tertiary: violet.base,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EDE9FE',
    onTertiaryContainer: '#4C1D95',

    error: t.error,
    onError: t.onError,
    errorContainer: t.errorSoft,
    onErrorContainer: t.error,

    background: t.bg,
    onBackground: t.text,
    surface: t.surface,
    onSurface: t.text,
    surfaceVariant: t.surface3,
    onSurfaceVariant: t.text2,

    outline: t.borderStrong,
    outlineVariant: t.border,

    inverseSurface: t.text,
    inverseOnSurface: t.bg,
    inversePrimary: t.accent,

    shadow: '#1B2433',
    scrim: 'rgba(12,20,33,0.45)',
    backdrop: 'rgba(12,20,33,0.4)',

    // Elevation ladder — Paper tints elevated surfaces (cards, menus) via these.
    elevation: {
      level0: 'transparent',
      level1: t.surface,
      level2: t.surface2,
      level3: t.surface2,
      level4: t.surface3,
      level5: t.surface3,
    },
  };
}

function brandFor(tokens: DawnTokens) {
  return {
    palette: { mountain, sunset, violet },
    tokens,
    semanticSoft,
    motion: { duration, easing, spring },
    shape: { radius, component: componentShape },
    spacing,
    shadows,
  } as const;
}

export const lightTheme = {
  ...MD3LightTheme,
  roundness: componentShape.card,
  fonts,
  colors: buildColors(dawnLight, MD3LightTheme.colors),
  brand: brandFor(dawnLight),
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: componentShape.card,
  fonts,
  colors: buildColors(dawnDark, MD3DarkTheme.colors),
  brand: brandFor(dawnDark),
};

export type AppTheme = typeof lightTheme;

/**
 * Reusable header options — Mountain Dawn uses a light, surface-coloured
 * header with graphite ink and a hairline divider (not a saturated bar),
 * matching the design system's large-title AppHeader.
 *
 * Typed structurally (only the colours it reads) so both Paper's `MD3Theme`
 * (from `useTheme()`) and our `AppTheme` (from `useAppTheme()`) satisfy it.
 */
export function getHeaderStyle(theme: {
  colors: { surface: string; onSurface: string };
}) {
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: { fontWeight: '700' as const, color: theme.colors.onSurface },
    headerShadowVisible: false,
  };
}
