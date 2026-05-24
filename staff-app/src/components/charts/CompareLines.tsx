/**
 * CompareLines — two-line overlay chart for "period over period" comparison.
 *
 * Pure react-native-svg (no Skia/victory) so it renders identically on iOS,
 * Android and web. Both series are expected to be aligned by index (day 1..N,
 * zero-filled) and scaled to a shared min/max so the lines are comparable.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  current: number[];
  previous: number[];
  height?: number;
  currentLabel?: string;
  previousLabel?: string;
}

const VIEW_W = 100;
const VIEW_H = 40;
const PAD = 2;

// Smoothed path via Catmull-Rom → cubic Bézier control points. `tension`
// keeps the curve close to the points without overshooting (0 = polyline).
function toPath(values: number[], min: number, range: number): string {
  if (values.length < 2) return '';
  const stepX = VIEW_W / (values.length - 1);
  const usableH = VIEW_H - PAD * 2;
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: PAD + (1 - (v - min) / range) * usableH,
  }));
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} L${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
  }
  const t = 0.2;
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function CompareLines({
  current,
  previous,
  height = 120,
  currentLabel = 'Текущий период',
  previousLabel = 'Прошлый период',
}: Props) {
  const theme = useAppTheme();
  const curColor = theme.colors.primary;
  const prevColor = theme.colors.outline;

  const { curPath, prevPath } = useMemo(() => {
    const all = [...current, ...previous, 0];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;
    return {
      curPath: toPath(current, min, range),
      prevPath: toPath(previous, min, range),
    };
  }, [current, previous]);

  if (!curPath && !prevPath) {
    return (
      <View style={[styles.empty, { height, backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodySmall" style={{ opacity: 0.5 }}>
          Недостаточно данных
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ height }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
          {prevPath ? (
            <Path
              d={prevPath}
              stroke={prevColor}
              strokeWidth={1.2}
              strokeDasharray="3,2"
              fill="none"
              opacity={0.8}
            />
          ) : null}
          {curPath ? (
            <Path
              d={curPath}
              stroke={curColor}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>
      <View style={styles.legend}>
        <Legend color={curColor} label={currentLabel} />
        <Legend color={prevColor} label={previousLabel} dashed />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: dashed ? 'transparent' : color, borderColor: color, borderWidth: dashed ? 1.5 : 0 },
        ]}
      />
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 4, borderRadius: 2 },
});
