/**
 * i18n public facade. All logic lives in `./core` (JSX-free) and
 * `./LanguageProvider` (JSX). This file just re-exports both so callers
 * can keep using `import { useT, LanguageProvider } from '../../i18n'`.
 */
export * from './core';
export { LanguageProvider } from './LanguageProvider';
