/**
 * ThemeProvider — wraps PaperProvider with auto/light/dark switching.
 *
 * Three modes:
 *   - "system" (default): follows iOS/Android system setting; updates live
 *     when the user toggles dark mode in Settings.
 *   - "light" / "dark": manual override, persisted in AsyncStorage.
 *
 * Why custom (vs Paper's default): Paper doesn't ship a system-aware theme
 * switcher with persistence. We also need to expose `setMode()` to the
 * Profile screen so the user can override.
 *
 * StatusBar style flips with the theme — fixes the white-on-white bug
 * when the user switches to dark mode mid-session.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { lightTheme, darkTheme, type AppTheme } from './index';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'staff-app:theme-mode';

interface ThemeApi {
  mode: ThemeMode;
  /** Resolved scheme actually in use ('light' | 'dark') — convenience for screens */
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeApi>({
  mode: 'system',
  scheme: 'light',
  setMode: async () => {},
});

function resolveScheme(mode: ThemeMode, system: ColorSchemeName): 'light' | 'dark' {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted mode on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') {
          setModeState(v);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // Subscribe to system appearance changes (only matters in 'system' mode,
  // but the listener is cheap and the resolver picks the right value).
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = async (next: ThemeMode) => {
    setModeState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const scheme = resolveScheme(mode, systemScheme);
  const theme: AppTheme = scheme === 'dark' ? darkTheme : lightTheme;

  const api = useMemo<ThemeApi>(() => ({ mode, scheme, setMode }), [mode, scheme]);

  // Don't render children until we've checked AsyncStorage — prevents a
  // light → dark "flash" on first paint when the user has dark persisted.
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={api}>
      <PaperProvider theme={theme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode(): ThemeApi {
  return useContext(ThemeContext);
}
