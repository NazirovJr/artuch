/**
 * Typed wrapper around Paper's `useTheme` so screens get autocomplete on
 * our extended theme (palette/motion/shape under `theme.brand`).
 *
 * Always import this — never `useTheme` from `react-native-paper` directly —
 * otherwise brand tokens lose their types.
 */
import { useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme';

export function useAppTheme(): AppTheme {
  return useTheme<AppTheme>();
}
