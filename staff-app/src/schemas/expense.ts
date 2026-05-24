/**
 * Expense form schemas — recording an operating-expense outflow and
 * managing the category directory.
 */
import { z } from 'zod';
import { dateSchema, optionalText, positiveAmount, requiredText } from './common';

export const expenseFormSchema = z.object({
  categoryId: z.string({ error: 'Выберите категорию' }).min(1, 'Выберите категорию'),
  amount: positiveAmount,
  paymentMethod: z.enum(['cash', 'card', 'bank', 'other']),
  spentAt: dateSchema,
  description: optionalText(500),
  vendor: optionalText(200),
  supplierId: optionalText(60),
  outletId: optionalText(60),
});

export type ExpenseForm = z.infer<typeof expenseFormSchema>;
export type ExpenseFormInput = z.input<typeof expenseFormSchema>;

export const expenseCategoryFormSchema = z.object({
  name: requiredText('Название'),
  group: z.enum([
    'rent',
    'payroll',
    'utilities',
    'supplies',
    'transport',
    'marketing',
    'maintenance',
    'tax',
    'other',
  ]),
  description: optionalText(500),
  isActive: z.boolean(),
});

export type ExpenseCategoryForm = z.infer<typeof expenseCategoryFormSchema>;
export type ExpenseCategoryFormInput = z.input<typeof expenseCategoryFormSchema>;
