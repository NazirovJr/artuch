import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ToastProvider } from './src/components/ui/Toast';
import { LanguageProvider } from './src/i18n';
import { useAppFonts, registerAppFont } from './src/hooks/useAppFonts';
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import {
  Unbounded_600SemiBold,
  Unbounded_700Bold,
} from '@expo-google-fonts/unbounded';
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

// ── Mountain Dawn typography ────────────────────────────────────
// Onest (sans, body/UI) + Unbounded (display, headlines & KPI numbers).
// Each weight is a distinct RN family; typography.ts maps variants onto these.
registerAppFont('Onest', Onest_400Regular);
registerAppFont('Onest-Medium', Onest_500Medium);
registerAppFont('Onest-SemiBold', Onest_600SemiBold);
registerAppFont('Onest-Bold', Onest_700Bold);
registerAppFont('Unbounded-SemiBold', Unbounded_600SemiBold);
registerAppFont('Unbounded-Bold', Unbounded_700Bold);

// Other optional assets (kitchen sound, etc.) register the same way — see
// assets/fonts/README.md and assets/sounds/README.md.

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
