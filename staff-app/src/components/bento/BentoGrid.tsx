/**
 * BentoGrid — flex-wrap container for BentoCards.
 *
 * Why not FlatList: bento layouts mix tile widths (sm/md = 48%, wide/lg =
 * 100%), and FlatList's `numColumns` enforces uniform widths. A simple
 * flex-wrap View handles mixed sizes naturally.
 *
 * Wrap children with `<BentoSection title="…">` to add a typographic
 * heading above a sub-grid; multiple sections stack vertically on a
 * single ScrollView in HomeScreen.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { spacing } from '../../theme/spacing';

export function BentoGrid({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

export function BentoSection({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      <BentoGrid>{children}</BentoGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
});
