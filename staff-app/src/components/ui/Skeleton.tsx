/**
 * Skeleton primitives — shimmer-loading placeholders in MD3-Expressive style.
 *
 * Why a new file instead of extending `LoadingSkeleton.tsx`:
 *   - shimmer needs an overlay layer (linear gradient sweep), so the API
 *     is genuinely different from the old opacity-pulse `<View>`.
 *   - `LoadingSkeleton.tsx` stays for back-compat with screens that still
 *     import it; new screens use these primitives.
 *
 * Performance: all animations run on the UI thread via Reanimated 3; no
 * setState / re-render per frame. Safe to render dozens of skeletons.
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '../../hooks/useAppTheme';
import { spacing, borderRadius } from '../../theme/spacing';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Atomic skeleton block — a single shimmering rectangle. */
export function Skeleton({ width = '100%', height = 16, radius = borderRadius.sm, style }: SkeletonProps) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -200 + progress.value * 400 }],
    opacity: 0.4,
  }));

  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.surfaceVariant, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.outlineVariant },
          overlayStyle,
        ]}
      />
    </View>
  );
}

/** Card-shaped skeleton — title + 2 lines + optional avatar. */
export function SkeletonCard({ withAvatar = false }: { withAvatar?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderRadius: borderRadius.md },
      ]}
    >
      {withAvatar && <Skeleton width={48} height={48} radius={24} style={styles.avatar} />}
      <View style={styles.cardBody}>
        <Skeleton width="65%" height={18} />
        <Skeleton width="90%" height={14} style={{ marginTop: spacing.sm }} />
        <Skeleton width="45%" height={14} style={{ marginTop: spacing.xs }} />
      </View>
    </View>
  );
}

/** List skeleton — vertically stacked rows. */
export function SkeletonList({
  count = 6,
  withAvatar = false,
  rowHeight,
}: {
  count?: number;
  withAvatar?: boolean;
  rowHeight?: number;
}) {
  const items = useMemo(() => Array.from({ length: count }), [count]);
  if (rowHeight) {
    return (
      <View style={styles.container}>
        {items.map((_, i) => (
          <Skeleton key={i} height={rowHeight} radius={borderRadius.sm} style={{ marginBottom: spacing.sm }} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {items.map((_, i) => (
        <View key={i} style={{ marginBottom: spacing.md }}>
          <SkeletonCard withAvatar={withAvatar} />
        </View>
      ))}
    </View>
  );
}

/** Grid skeleton — 2-column grid of cards (rooms, menu items, dashboards). */
export function SkeletonGrid({ count = 6, columns = 2 }: { count?: number; columns?: number }) {
  const items = useMemo(() => Array.from({ length: count }), [count]);
  const widthPct = `${100 / columns - 2}%` as DimensionValue;
  return (
    <View style={[styles.container, styles.grid]}>
      {items.map((_, i) => (
        <View key={i} style={{ width: widthPct, marginBottom: spacing.md }}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    flexDirection: 'row',
    padding: spacing.lg,
    minHeight: 100,
    alignItems: 'flex-start',
  },
  avatar: {
    marginRight: spacing.md,
  },
  cardBody: {
    flex: 1,
  },
});
