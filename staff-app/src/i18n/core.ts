/**
 * i18n internals — JSX-free core.
 *
 * Lives in its own module so `LanguageProvider.tsx` can import from it
 * without creating a cycle with `index.ts` (index re-exports the provider).
 * `index.ts` is a thin facade — it re-exports from this file plus the
 * provider from `./LanguageProvider`.
 */
import { createContext, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import ru from './ru';
import en from './en';
import tg from './tg';

export type Lang = 'ru' | 'en' | 'tg';

type TranslationTree = typeof ru;

export const translations: Record<Lang, TranslationTree> = { ru, en, tg };
export const STORAGE_KEY = 'staff-app:lang';

/** Mutable global — read by raw `t()` calls outside React. */
let currentLang: Lang = 'ru';
export const subscribers = new Set<(lang: Lang) => void>();

export function resolvePath(tree: unknown, path: string): string {
  const keys = path.split('.');
  let result: any = tree;
  for (const key of keys) {
    result = result?.[key];
  }
  return typeof result === 'string' ? result : path;
}

export function t(path: string): string {
  return resolvePath(translations[currentLang] || translations.ru, path);
}

export function setLanguage(lang: Lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  subscribers.forEach((fn) => fn(lang));
  AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
}

export function getLanguage(): Lang {
  return currentLang;
}

/** Internal — used by LanguageProvider to sync imperative globals. */
export function _setCurrentLangInternal(lang: Lang) {
  currentLang = lang;
}

export function detectDeviceLang(): Lang {
  try {
    const locale =
      Platform.OS === 'ios'
        ? (NativeModules.SettingsManager?.settings?.AppleLocale as string) ||
          (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string)
        : (NativeModules.I18nManager?.localeIdentifier as string);
    const lower = (locale || '').toLowerCase();
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('tg') || lower.startsWith('tj')) return 'tg';
    return 'ru';
  } catch {
    return 'ru';
  }
}

export interface LanguageApi {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LanguageContext = createContext<LanguageApi>({
  lang: 'ru',
  setLang: setLanguage,
});

export function useLanguage(): LanguageApi {
  return useContext(LanguageContext);
}

/**
 * Subscribes to language changes and returns a `t(path)` closure.
 * Use inside components; prefer raw `t()` for non-React code.
 */
export function useT(): (path: string) => string {
  const { lang } = useLanguage();
  return useCallback((path: string) => resolvePath(translations[lang], path), [lang]);
}
