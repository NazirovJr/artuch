/**
 * Folio form schemas — charges/payments/discounts/deposits.
 */
import { z } from 'zod';
import { optionalText, positiveAmount, positiveInt, requiredText } from './common';

export const chargeTypeEnum = z.enum([
  'room',
  'restaurant',
  'bar',
  'shop',
  'rental',
  'service',
]);
export type ChargeType = z.infer<typeof chargeTypeEnum>;

export const folioModeEnum = z.enum(['charge', 'payment', 'discount', 'deposit']);
export type FolioMode = z.infer<typeof folioModeEnum>;

/**
 * AddCharge form. `description` is required when posting a charge but
 * optional for payment/discount/deposit — enforced in `.superRefine` so
 * the validator can see the active `mode`.
 */
export const addChargeSchema = z
  .object({
    mode: folioModeEnum,
    chargeType: chargeTypeEnum.optional(),
    description: optionalText(200),
    amount: positiveAmount,
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'charge') {
      if (!data.chargeType) {
        ctx.addIssue({
          code: 'custom',
          path: ['chargeType'],
          message: 'Выберите тип начисления',
        });
      }
      if (!data.description || data.description.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'Введите описание',
        });
      }
    }
  });

export type AddChargeForm = z.infer<typeof addChargeSchema>;
export type AddChargeInput = z.input<typeof addChargeSchema>;

/** New folio (header) */
export const newFolioSchema = z.object({
  guestId: z.string().uuid('Выберите гостя').optional(),
  roomNumber: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    positiveInt.optional(),
  ),
  notes: optionalText(500),
});
export type NewFolioForm = z.infer<typeof newFolioSchema>;
export type NewFolioInput = z.input<typeof newFolioSchema>;
