import { type Theme } from 'react-native-paper';

/** Shared header screen options — used by all 7 stack navigators */
export function getDefaultScreenOptions(theme: Theme) {
  return {
    headerStyle: { backgroundColor: theme.colors.primary },
    headerTintColor: theme.colors.onPrimary,
    headerTitleStyle: { fontWeight: 'bold' as const },
    headerShadowVisible: true,
  };
}
