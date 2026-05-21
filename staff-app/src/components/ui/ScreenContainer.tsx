import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from './LoadingSkeleton';
import { contentMaxWidth, type ContentWidth } from '../../theme/breakpoints';

interface ScreenContainerProps {
  /** Optional — when `loading` is true the skeleton replaces children. */
  children?: ReactNode;
  loading?: boolean;
  skeletonCount?: number;
  /**
   * Constrains content width on tablets/desktop/web so forms and lists
   * stay readable. Pick the variant that matches the screen's role:
   *   - "reading" (720px) — forms, single-column detail screens
   *   - "grid"    (1400px) — multi-column lists, dashboards
   *   - "full"    (default) — kanban, full-bleed layouts
   * On phones nothing is clamped — content already fits the viewport.
   */
  maxWidth?: ContentWidth;
}

export default function ScreenContainer({
  children,
  loading,
  skeletonCount = 4,
  maxWidth = 'full',
}: ScreenContainerProps) {
  const theme = useTheme();
  const limit = contentMaxWidth[maxWidth];

  // When maxWidth is set, wrap content in a centred box. We don't gate this
  // on breakpoint — `maxWidth: 720` is a no-op on a 375dp phone (content
  // already fits), and the same rule then kicks in on iPad/web automatically.
  const inner = loading ? <LoadingSkeleton count={skeletonCount} /> : children;
  const body =
    limit !== undefined ? (
      <View style={[styles.centeredOuter]}>
        <View style={[styles.centeredInner, { maxWidth: limit }]}>{inner}</View>
      </View>
    ) : (
      inner
    );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>{body}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  centeredOuter: { flex: 1, alignItems: 'center' },
  centeredInner: { flex: 1, width: '100%' },
});
