/**
 * Cross-platform confirmation dialog.
 *
 * `Alert.alert` from react-native is NOT implemented in react-native-web,
 * so any code using it on web will silently no-op (the onPress handler
 * never fires). This wrapper routes to `window.confirm` on web and to
 * the native Alert on iOS/Android.
 *
 * Returns a promise that resolves with the user's choice. Designed to
 * be simpler than the full Alert API — we only need confirm/cancel.
 *
 * Usage:
 *   const ok = await confirm({ title: 'Заселить?', message: 'Продолжить?' });
 *   if (!ok) return;
 *   await doTheThing();
 */
import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message = '',
    confirmLabel = 'OK',
    cancelLabel = 'Отмена',
    destructive = false,
  } = opts;

  if (Platform.OS === 'web') {
    // Native browser confirm. Blocks but works everywhere.
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(text));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
