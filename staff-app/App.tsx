import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ToastProvider } from './src/components/ui/Toast';
import { LanguageProvider } from './src/i18n';
import { useAppFonts } from './src/hooks/useAppFonts';
import { installWebAlertPolyfill } from './src/utils/webAlertPolyfill';
import {
  getBaseUrl,
  getToken,
  registerOutboxEnqueue,
} from './src/api/client';
import {
  drainOutbox,
  enqueueOutbox,
  startOutboxAutoDrain,
} from './src/api/outbox';
// Side-effect: configures Zod's global error map to Russian. Loaded at the
// app entry so every form everywhere gets RU defaults.
import './src/schemas/setup';

// react-native-web ships Alert.alert as a silent no-op. Replace it with
// a window.confirm-backed bridge so every screen's confirmation dialog
// (Заселить, Выселить, Удалить, …) keeps working on web without rewrites.
// On iOS/Android this call is a no-op.
installWebAlertPolyfill();

// Register optional assets here — see assets/fonts/README.md and
// assets/sounds/README.md for the exact snippets. Without registration
// both subsystems gracefully no-op (system font + silent chime).
//
// Example:
//   import { registerAppFont } from './src/hooks/useAppFonts';
//   registerAppFont('RobotoFlex', require('@expo-google-fonts/roboto-flex/RobotoFlex_400Regular.ttf'));
//
//   import { registerKitchenSound } from './src/hooks/useKitchenSound';
//   registerKitchenSound(require('./assets/sounds/new-order.mp3'));

// Wire the outbox bridge once at module load — apiFetch consults this to
// queue mutations on transport failure, and an attempt is made to drain
// the queue immediately so anything stuck from a previous session goes
// out as soon as we have credentials.
registerOutboxEnqueue(enqueueOutbox);

export default function App() {
  const { ready: fontsReady } = useAppFonts();

  useEffect(() => {
    // One-shot drain at startup, plus a NetInfo subscription that drains
    // every time we regain connectivity.
    drainOutbox(getBaseUrl(), getToken).catch(() => {});
    const unsub = startOutboxAutoDrain(getBaseUrl(), getToken);
    return unsub;
  }, []);

  // Block render until async assets resolve. With no registered fonts this
  // returns `true` on the first call, so there's no perceived delay.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
