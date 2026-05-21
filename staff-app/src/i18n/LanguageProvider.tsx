/**
 * LanguageProvider — React Context wrapper for the i18n core.
 *
 * Imports from './core' (not './index') to avoid a module cycle: index.ts
 * re-exports LanguageProvider, so if this file pulled anything from './index'
 * both files would be half-initialised at import time.
 */
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LanguageContext,
  STORAGE_KEY,
  _setCurrentLangInternal,
  detectDeviceLang,
  getLanguage,
  setLanguage,
  subscribers,
  type Lang,
  type LanguageApi,
} from './core';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLanguage());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const initial: Lang =
          stored === 'ru' || stored === 'en' || stored === 'tg'
            ? stored
            : detectDeviceLang();
        _setCurrentLangInternal(initial);
        setLangState(initial);
      })
      .finally(() => setHydrated(true));

    // Keep component state in sync with imperative `setLanguage()` calls.
    const sub = (next: Lang) => setLangState(next);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const setLang = useCallback((next: Lang) => setLanguage(next), []);
  const api = useMemo<LanguageApi>(() => ({ lang, setLang }), [lang, setLang]);

  if (!hydrated) return null;

  return <LanguageContext.Provider value={api}>{children}</LanguageContext.Provider>;
}
