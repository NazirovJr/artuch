/**
 * Motion tokens — single source of truth for animation timings & easings.
 *
 * Material 3 Expressive emphasises *physics-based* motion, so springs are the
 * default; durations are kept only for fades / opacity transitions where
 * spring doesn't apply. "Animate uncertainty, not everything" — use the
 * shortest preset that still reads as deliberate.
 */
import { Easing, withSpring, withTiming } from 'react-native-reanimated';

export const duration = {
  /** Tap feedback, badge updates */
  fast: 150,
  /** Card mount, sheet open */
  medium: 250,
  /** Page transitions, large layout shifts */
  slow: 400,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0.0, 0, 1.0),
  emphasized: Easing.bezier(0.3, 0.0, 0.0, 1.0),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
} as const;

export const spring = {
  /** Default — bouncy enough to feel alive without being annoying */
  default: { stiffness: 350, damping: 30, mass: 1 },
  /** Gentle — used for sheets, dialogs */
  gentle: { stiffness: 200, damping: 28, mass: 1 },
  /** Snappy — taps, toggles */
  snappy: { stiffness: 500, damping: 32, mass: 1 },
} as const;

/** Reanimated helpers using the tokens above */
export const animations = {
  fadeIn: () => withTiming(1, { duration: duration.medium, easing: easing.decelerate }),
  fadeOut: () => withTiming(0, { duration: duration.fast, easing: easing.accelerate }),
  springIn: () => withSpring(1, spring.default),
} as const;
