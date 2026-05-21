/**
 * Theme entry — composes light/dark MD3 themes from semantic submodules.
 *
 * Brand colours live in `palette.ts`; status colours in `colors.ts`;
 * timing in `motion.ts`; corner radii in `shape.ts`; type scale in `typography.ts`.
 * Anything that is *not* a Paper MD3 token (palette, motion, shape) is exposed
 * via the `brand` namespace on the theme so screens can pull it via
 * `useAppTheme()` without losing TS autocomplete.
 */
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { mountain, sunset, violet, lightSurfaces, darkSurfaces } from './palette';
import { typeScale } from './typography';
import { radius, componentShape } from './shape';
import { duration, easing, spring } from './motion';

export { spacing, borderRadius, shadows } from './spacing';
export * from './colors';
export * from './palette';
export * from './motion';
export * from './shape';
export * from './typography';

const fonts = configureFonts({ config: typeScale });

const brand = {
  palette: { mountain, sunset, violet },
  motion: { duration, easing, spring },
  shape: { radius, component: componentShape },
} as const;

export const lightTheme = {
  ...MD3LightTheme,
  roundness: componentShape.card,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: mountain.deep,
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBEAFE',
    onPrimaryContainer: mountain.deep,
    secondary: sunset.warm,
    onSecondary: '#000000',
    secondaryContainer: '#FEF3C7',
    onSecondaryContainer: '#78350F',
    tertiary: violet.base,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EDE9FE',
    onTertiaryContainer: '#4C1D95',
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',
    background: lightSurfaces.background,
    surface: lightSurfaces.surface,
    surfaceVariant: lightSurfaces.surfaceVariant,
    outline: lightSurfaces.outline,
    outlineVariant: lightSurfaces.outlineVariant,
  },
  brand,
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: componentShape.card,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: mountain.sky,
    onPrimary: '#000000',
    primaryContainer: mountain.deep,
    onPrimaryContainer: '#DBEAFE',
    secondary: sunset.light,
    onSecondary: '#000000',
    secondaryContainer: '#78350F',
    onSecondaryContainer: '#FEF3C7',
    tertiary: violet.light,
    onTertiary: '#000000',
    tertiaryContainer: '#4C1D95',
    onTertiaryContainer: '#EDE9FE',
    error: '#F87171',
    onError: '#000000',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FEE2E2',
    background: darkSurfaces.background,
    surface: darkSurfaces.surface,
    surfaceVariant: darkSurfaces.surfaceVariant,
    outline: darkSurfaces.outline,
    outlineVariant: darkSurfaces.outlineVariant,
  },
  brand,
};

export type AppTheme = typeof lightTheme;

/** Reusable header screen options — eliminates hardcoded HEADER_STYLE in every stack */
export function getHeaderStyle(theme: AppTheme) {
  return {
    headerStyle: { backgroundColor: theme.colors.primary },
    headerTintColor: theme.colors.onPrimary,
    headerTitleStyle: { fontWeight: 'bold' as const },
    headerShadowVisible: true,
  };
}
