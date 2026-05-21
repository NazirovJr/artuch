/**
 * Reusable Zod schemas — share them across forms instead of redefining the
 * same regex/range over and over. Every helper below picks a sensible
 * default error message in Russian; schemas can override per-field via
 * the standard `.refine` / `.min` overloads.
 *
 * Convention: emit `undefined` (via `optional()`) instead of empty strings
 * for blank fields so the API layer can decide whether to omit the key
 * entirely. Trim everything by default — the staff app pipes a lot of
 * scanned/dictated input where trailing spaces are common.
 */
import { z } from 'zod';

/** Empty input is treated as "not provided" — schema becomes optional. */
const blankToUndefined = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/** Required, non-empty trimmed text. Use as a default for any "name" field. */
export const requiredText = (label = 'Поле') =>
  z.string({ error: `${label} обязательно` }).trim().min(1, `${label} обязательно`);

/** Optional, trimmed text. Empty becomes `undefined` — useful for `notes`. */
export const optionalText = (max = 500) =>
  z.preprocess(blankToUndefined, z.string().max(max, `Не больше ${max} символов`).optional());

/** Email — optional. Use `.unwrap()` to require it. */
export const emailSchema = z.preprocess(
  blankToUndefined,
  z.email('Неверный формат email').optional(),
);

/** Permissive phone — international format with separators allowed. */
export const phoneSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Неверный формат телефона')
    .optional(),
);

/** Manager / staff PIN: 4–6 digits. */
export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, 'PIN должен состоять из 4–6 цифр');

/** Optional PIN — empty means "don't change" on edit forms. */
export const optionalPinSchema = z.preprocess(
  blankToUndefined,
  pinSchema.optional(),
);

/** Username: lowercase letters, digits, _ and -, 3–32 chars. */
export const usernameSchema = z
  .string({ error: 'Имя пользователя обязательно' })
  .trim()
  .regex(
    /^[a-z0-9_-]{3,32}$/,
    'Только латиница в нижнем регистре, цифры, _, -. От 3 до 32 символов',
  );

/** Password ≥ 8 chars. Doesn't enforce complexity — that's a policy decision. */
export const passwordSchema = z
  .string({ error: 'Пароль обязателен' })
  .min(8, 'Пароль должен быть не короче 8 символов');

/** Optional password — empty means "don't change" on edit forms. */
export const optionalPasswordSchema = z.preprocess(
  blankToUndefined,
  passwordSchema.optional(),
);

/** Positive amount in TJS (or any currency). Allows decimals. */
export const positiveAmount = z
  .number({ error: 'Введите сумму' })
  .positive('Сумма должна быть больше нуля')
  .max(10_000_000, 'Сумма слишком большая');

/** Non-negative amount (cash counts, deposits). */
export const nonNegativeAmount = z
  .number({ error: 'Введите сумму' })
  .min(0, 'Сумма не может быть отрицательной')
  .max(10_000_000, 'Сумма слишком большая');

/** Positive integer (table number, room number, quantities). */
export const positiveInt = z
  .number({ error: 'Введите число' })
  .int('Должно быть целое число')
  .positive('Должно быть больше нуля');

/** Quantity 1..1000 — guards against pasting absurd values. */
export const quantity = z
  .number({ error: 'Введите количество' })
  .int('Должно быть целое число')
  .min(1, 'Минимум 1')
  .max(1000, 'Максимум 1000');

/** Number of guests in a reservation: 1..10. */
export const guestCount = z
  .number({ error: 'Введите число' })
  .int('Должно быть целое число')
  .min(1, 'Минимум 1 гость')
  .max(10, 'Максимум 10 гостей');

/** Date — strict; rejects `Invalid Date`. */
export const dateSchema = z
  .date({ error: 'Выберите дату' })
  .refine((d) => !Number.isNaN(d.getTime()), 'Неверная дата');

/** Cross-field helper: ensure end > start. Use inside `.refine()` on a parent object. */
export const isAfter = (start: Date, end: Date) => end.getTime() > start.getTime();
