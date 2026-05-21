/**
 * useAppFonts — gates UI on async font loading.
 *
 * Registry pattern (same rationale as useKitchenSound): Metro resolves
 * requires statically, so we can't `require('RobotoFlex.ttf')` at module
 * scope if the file is optional. Instead screens/boot code register fonts
 * via `registerAppFont('RobotoFlex', require(...))` before App mounts;
 * this hook then passes the accumulated map to expo-font's `useFonts`.
 *
 * If nothing is registered, the hook short-circuits to `ready: true`
 * immediately — the app falls back to the platform system font and renders
 * without delay.
 *
 * To enable Roboto Flex (Material 3 Expressive default):
 *   1. `npx expo install @expo-google-fonts/roboto-flex`
 *   2. In App.tsx, before `<App/>` mounts:
 *      import { registerAppFont } from './src/hooks/useAppFonts';
 *      registerAppFont('RobotoFlex', require('@expo-google-fonts/roboto-flex/RobotoFlex_400Regular.ttf'));
 *      registerAppFont('RobotoFlex-Medium', require('@expo-google-fonts/roboto-flex/RobotoFlex_500Medium.ttf'));
 *   3. In src/theme/typography.ts change FONT_FAMILY_* to 'RobotoFlex' / 'RobotoFlex-Medium'.
 */
import { useFonts } from 'expo-font';

type FontMap = Record<string, number>;

// Module-scope registry. Populated before React renders.
const REGISTERED_FONTS: FontMap = {};

/** Register a font family for async loading. Call at boot, before <App/>. */
export function registerAppFont(name: string, assetModule: number) {
  REGISTERED_FONTS[name] = assetModule;
}

/**
 * Loads all registered fonts asynchronously.
 * Returns `ready=true` as soon as (a) nothing is registered, or (b) all
 * registered fonts are loaded / failed. Any single failure is logged but
 * does not block the UI — we fall back to system font per family.
 */
export function useAppFonts(): { ready: boolean } {
  const [loaded, error] = useFonts(REGISTERED_FONTS);

  if (Object.keys(REGISTERED_FONTS).length === 0) {
    return { ready: true };
  }

  if (error) {
    // Log once and unblock UI — system font is a valid fallback.
    console.warn('[useAppFonts] font load failed; falling back to system font', error);
    return { ready: true };
  }

  return { ready: loaded };
}
