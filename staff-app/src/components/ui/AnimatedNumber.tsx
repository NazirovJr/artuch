/**
 * AnimatedNumber — counts up to `value` on mount / when it changes.
 *
 * JS-driven (requestAnimationFrame + easeOutCubic) so any JS formatter works
 * (money, percent, thousands separators) — unlike a UI-thread worklet which
 * can't run Intl.NumberFormat. For a handful of KPI tiles the cost is trivial.
 *
 * Honours the OS "reduce motion" setting: jumps straight to the value.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

interface Props {
  value: number;
  /** Formats the in-flight number for display (e.g. money, percent). */
  format?: (n: number) => string;
  /** Animation duration in ms. */
  duration?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 900,
  style,
  numberOfLines,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const delta = value - from;
    const start = Date.now();
    let raf = 0;

    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplay(from + delta * easeOutCubic(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduceMotion]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {format(display)}
    </Text>
  );
}
