/**
 * Income form schemas — recording an other-income inflow and managing the
 * category directory. Mirrors the expense schemas.
 */
import { z } from 'zod';
import { dateSchema, optionalText, positiveAmount, requiredText } from './common';

export const incomeFormSchema = z.object({
  categoryId: z.string({ error: 'Выберите категорию' }).min(1, 'Выберите категорию'),
  amount: positiveAmount,
  paymentMethod: z.enum(['cash', 'card', 'bank', 'other']),
  receivedAt: dateSchema,
  description: optionalText(500),
  payer: optionalText(200),
  outletId: optionalText(60),
});

export type IncomeForm = z.infer<typeof incomeFormSchema>;
export type IncomeFormInput = z.input<typeof incomeFormSchema>;

export const incomeCategoryFormSchema = z.object({
  name: requiredText('Название'),
  group: z.enum([
    'service',
    'rent',
    'event',
    'asset',
    'partner',
    'grant',
    'other',
  ]),
  description: optionalText(500),
  isActive: z.boolean(),
});

export type IncomeCategoryForm = z.infer<typeof incomeCategoryFormSchema>;
export type IncomeCategoryFormInput = z.input<typeof incomeCategoryFormSchema>;
