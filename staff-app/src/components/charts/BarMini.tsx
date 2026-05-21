/**
 * BarMini — horizontal bar strip for top-N lists (top items, top staff).
 *
 * Built on react-native-svg rather than victory-native's CartesianChart
 * because horizontal bars with categorical labels need less machinery —
 * and this keeps the mini-chart free of the Skia cost for a 5-bar widget.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { spacing } from '../../theme/spacing';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarMiniProps {
  data: BarDatum[];
  /** Max bars to render; rest are dropped */
  limit?: number;
  /** Override bar colour (defaults to theme.colors.primary) */
  color?: string;
  /** Format the trailing value text (e.g. "1 234 TJS") */
  formatValue?: (v: number) => string;
}

export default function BarMini({
  data,
  limit = 5,
  color,
  formatValue = (v) => String(v),
}: BarMiniProps) {
  const theme = useAppTheme();
  const accent = color ?? theme.colors.primary;
  const items = data.slice(0, limit);
  const max = Math.max(1, ...items.map((d) => d.value));

  if (items.length === 0) {
    return (
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Нет данных
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const pct = Math.max(0.04, item.value / max); // keep tiny bars visible
        return (
          <View key={item.label} style={styles.row}>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={[styles.label, { color: theme.colors.onSurface }]}
            >
              {item.label}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct * 100}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text
              variant="labelMedium"
              style={[styles.value, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatValue(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flexBasis: 80,
    flexShrink: 1,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  value: {
    minWidth: 48,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
