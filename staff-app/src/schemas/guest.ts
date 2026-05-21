/**
 * Guest form schemas. Used by both the simple GuestForm and the
 * navigation-driven GuestFormNav screens.
 */
import { z } from 'zod';
import { emailSchema, optionalText, phoneSchema, requiredText } from './common';

export const guestSchema = z.object({
  firstName: requiredText('Имя'),
  lastName: requiredText('Фамилия'),
  passportNumber: optionalText(20),
  phone: phoneSchema,
  email: emailSchema,
  nationality: optionalText(60),
});

export type GuestForm = z.infer<typeof guestSchema>;
