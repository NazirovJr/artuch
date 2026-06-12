/**
 * Web polyfill for `Alert.alert`.
 *
 * react-native-web ships `Alert.alert` as a silent no-op, so every code
 * path that relies on the Alert callback (e.g. confirmation dialogs with
 * onPress handlers) does nothing on web — the dialog never shows, and the
 * user's button press is lost. Since ~23 screens in this app use that
 * pattern for confirmations (Заселить, Выселить, Удалить, etc.), patching
 * the Alert global is the cheapest fix: single override, every caller
 * starts working without touching their code.
 *
 * Strategy: replace `Alert.alert` with a bridge that:
 *   1. Joins title + message into a single `window.confirm` prompt.
 *   2. Treats confirm→true as clicking the non-cancel button.
 *   3. Treats confirm→false (or no confirm on info-only alerts) as the
 *      cancel button.
 *   4. Invokes the matching button's `onPress` if present.
 *
 * Info-only alerts (no buttons, or a single OK) still work — we just show
 * the window.confirm and invoke the first button's handler regardless of
 * the user's choice, matching the "dismiss" semantic.
 *
 * Native platforms are untouched — this module is a no-op on iOS/Android.
 *
 * Must be imported from App.tsx before any screen renders.
 */
import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export function installWebAlertPolyfill() {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;

  // Cast to the exact Alert.alert type: we intentionally ignore the 4th
  // `options` arg and use a narrower button shape, which is structurally
  // fine for a web confirm() bridge but trips strict function-type checks.
  Alert.alert = ((title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;

    const safeBtns = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const cancelBtn = safeBtns.find((b) => b.style === 'cancel');
    const confirmBtn = safeBtns.find((b) => b.style !== 'cancel') ?? safeBtns[0];

    // Info-only (just an OK button): treat as a notification — run the
    // single handler regardless of confirm outcome, so the UI flow isn't
    // stuck waiting for something that will never happen.
    const isInfoOnly = safeBtns.length === 1;

    let ok = false;
    try {
      ok = window.confirm(text);
    } catch {
      ok = false;
    }

    try {
      if (isInfoOnly) {
        safeBtns[0].onPress?.();
      } else if (ok) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } catch (e) {
      // Swallow — polyfill shouldn't crash the app if a handler throws.
      // eslint-disable-next-line no-console
      console.error('[webAlertPolyfill] button handler threw', e);
    }
  }) as typeof Alert.alert;
}
