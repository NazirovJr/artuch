/**
 * Rental form schemas — handing equipment out to guests.
 */
import { z } from 'zod';
import { dateSchema, optionalText, positiveAmount, quantity, requiredText } from './common';

export const newRentalSchema = z
  .object({
    itemId: optionalText(60),
    itemName: requiredText('Название предмета'),
    guestId: optionalText(60),
    outletId: optionalText(60),
    quantity: quantity,
    pricePerDay: positiveAmount,
    expectedReturn: dateSchema,
  })
  .refine((d) => d.expectedReturn.getTime() > Date.now() - 86_400_000, {
    message: 'Дата возврата не может быть в прошлом',
    path: ['expectedReturn'],
  });

export type NewRentalForm = z.infer<typeof newRentalSchema>;
export type NewRentalInput = z.input<typeof newRentalSchema>;
