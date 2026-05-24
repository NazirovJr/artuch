/** Shared header screen options — typed structurally (Paper MD3Theme / AppTheme). */
export function getDefaultScreenOptions(theme: {
  colors: { primary: string; onPrimary: string };
}) {
  return {
    headerStyle: { backgroundColor: theme.colors.primary },
    headerTintColor: theme.colors.onPrimary,
    headerTitleStyle: { fontWeight: 'bold' as const },
    headerShadowVisible: true,
  };
}
