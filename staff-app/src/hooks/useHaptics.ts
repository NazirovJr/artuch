/**
 * useHaptics — central wrapper around expo-haptics.
 *
 * Why a hook instead of importing Haptics directly:
 *   - lets us add a global "haptics off" toggle later (Profile setting)
 *   - safely no-ops on web where Haptics isn't available
 *   - one place to map UX events ("button tap", "success") to physical
 *     feedback intensity, so the app feels consistent
 *
 * Calling these is fire-and-forget; failures are silently swallowed because
 * haptics are progressive enhancement, never required for correctness.
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (...args: Parameters<T>) => {
    if (!isSupported) return;
    fn(...args).catch(() => {
      /* haptics are best-effort; never block UX */
    });
  };
}

export interface HapticsApi {
  /** Soft tap — toggles, list selections, drawer open */
  light: () => void;
  /** Standard tap — primary buttons, confirmations */
  medium: () => void;
  /** Strong tap — destructive actions, long-press triggers */
  heavy: () => void;
  /** Success notification — order completed, payment received */
  success: () => void;
  /** Warning notification — low stock, expiring item */
  warning: () => void;
  /** Error notification — failed action, validation error */
  error: () => void;
  /** Selection change — picker, segmented control, slider tick */
  selection: () => void;
}

export function useHaptics(): HapticsApi {
  return {
    light: useCallback(safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), []),
    medium: useCallback(safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), []),
    heavy: useCallback(safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), []),
    success: useCallback(safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), []),
    warning: useCallback(safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)), []),
    error: useCallback(safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)), []),
    selection: useCallback(safe(() => Haptics.selectionAsync()), []),
  };
}
