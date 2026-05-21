/**
 * Zod global setup — applied once at module load. Switches the default
 * error messages to Russian so all UI errors come out localised even when
 * a schema doesn't declare a custom message.
 *
 * Importing this file once (we do it from the central `src/schemas/index.ts`
 * barrel) is enough — Zod's `config()` is global state. Schemas defined
 * elsewhere don't need to know about it.
 *
 * If we ever wire up multilingual UI (currently the staff app is RU-only
 * for forms), swap `ru()` for `en()` / `tg()` based on the active language.
 */
import { z, locales } from 'zod';

z.config({
  localeError: locales.ru().localeError,
});
