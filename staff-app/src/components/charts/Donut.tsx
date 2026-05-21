/**
 * Donut — circular progress for percentages (occupancy, conversion, etc.).
 *
 * Pure react-native-svg — a two-segment donut doesn't need the full
 * victory/Skia pipeline. Renders the filled arc + a soft track ring and
 * the percentage centred in the middle.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';

interface DonutProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  /** Override centre text (defaults to `${Math.round(value*100)}%`) */
  centerText?: string;
}

export default function Donut({
  value,
  size = 120,
  strokeWidth = 12,
  label,
  color,
  centerText,
}: DonutProps) {
  const theme = useAppTheme();
  const accent = color ?? theme.colors.primary;
  const clamped = Math.max(0, Math.min(1, value));

  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * clamped;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={theme.colors.surfaceVariant}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={accent}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash}, ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text
          variant="titleLarge"
          style={{ color: theme.colors.onSurface, fontWeight: '700' }}
        >
          {centerText ?? `${Math.round(clamped * 100)}%`}
        </Text>
        {label ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
