/**
 * Sparkline — tiny inline line chart, fits inside a BentoCard.
 *
 * victory-native v41 uses `CartesianChart` + `Line` (Skia-backed). We
 * hide axes/labels — a sparkline is just the shape, no chrome.
 *
 * Web fallback: Skia 2.x on web needs CanvasKit-WASM loaded via
 * `LoadSkiaWeb()`, which we don't wire up yet. Rather than crash with
 * `XYWHRect of undefined`, the component renders a lightweight SVG
 * polyline instead — still shows the shape, just without the skia glow.
 */
import React, { useMemo } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../../hooks/useAppTheme';

interface SparklineProps {
  values: number[];
  height?: number;
  width?: number | `${number}%`;
  /** Override colour; defaults to theme.colors.primary */
  color?: string;
  /** Fill area under line with faded colour */
  fillArea?: boolean;
  style?: ViewStyle;
}

/**
 * Plain-SVG sparkline for platforms where Skia isn't available (web).
 * Normalises values into the viewbox and builds a straight-segment path.
 */
function SparklineSvg({
  values,
  height,
  stroke,
  fillArea,
  style,
  surfaceVariant,
}: {
  values: number[];
  height: number;
  stroke: string;
  fillArea: boolean;
  style?: ViewStyle;
  surfaceVariant: string;
}) {
  const VIEW_W = 100; // viewBox width; SVG scales to container
  const VIEW_H = 30;

  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = VIEW_W / (values.length - 1);
    const pad = 2;
    const usableH = VIEW_H - pad * 2;
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = pad + (1 - (v - min) / range) * usableH;
      return [x, y] as const;
    });
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  }, [values]);

  const areaPath = useMemo(() => {
    if (!fillArea || !path) return '';
    return `${path} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
  }, [path, fillArea]);

  if (!path) {
    return (
      <View style={[{ height, backgroundColor: surfaceVariant, borderRadius: 8 }, style]} />
    );
  }

  return (
    <View style={[{ height, width: '100%' }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
        {fillArea && <Path d={areaPath} fill={stroke} fillOpacity={0.18} />}
        <Path d={path} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export default function Sparkline({
  values,
  height = 64,
  color,
  fillArea = true,
  style,
}: SparklineProps) {
  const theme = useAppTheme();
  const stroke = color ?? theme.colors.primary;

  const data = useMemo(
    () => values.map((y, x) => ({ x, y })),
    [values],
  );

  // Empty / single-point: just render a flat placeholder so the bento
  // slot doesn't collapse.
  if (data.length < 2) {
    return (
      <View
        style={[
          { height, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8 },
          style,
        ]}
      />
    );
  }

  // Web: CanvasKit-WASM init is non-trivial — ship a plain-SVG version
  // instead. Mobile (iOS/Android) keeps the Skia-powered chart.
  if (Platform.OS === 'web') {
    return (
      <SparklineSvg
        values={values}
        height={height}
        stroke={stroke}
        fillArea={fillArea}
        style={style}
        surfaceVariant={theme.colors.surfaceVariant}
      />
    );
  }

  return (
    <View style={[{ height, width: '100%' }, style]}>
      <CartesianChart
        data={data}
        xKey="x"
        yKeys={['y']}
        domainPadding={{ top: 6, bottom: 2 }}
      >
        {({ points }) => (
          <>
            {fillArea && (
              <Area
                points={points.y}
                y0={0}
                color={stroke}
                opacity={0.18}
                animate={{ type: 'timing', duration: 400 }}
              />
            )}
            <Line
              points={points.y}
              color={stroke}
              strokeWidth={2.5}
              animate={{ type: 'timing', duration: 400 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}
