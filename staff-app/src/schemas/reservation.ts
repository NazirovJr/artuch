/**
 * Reservation form schemas. Cross-field rule: checkOutDate > checkInDate.
 */
import { z } from 'zod';
import { dateSchema, guestCount, optionalText, positiveInt } from './common';

export const newReservationSchema = z
  .object({
    guestId: z.string({ error: 'Выберите гостя' }).min(1, 'Выберите гостя'),
    roomNumber: positiveInt,
    checkInDate: dateSchema,
    checkOutDate: dateSchema,
    numberOfGuests: guestCount,
    notes: optionalText(500),
  })
  .refine((d) => d.checkOutDate.getTime() > d.checkInDate.getTime(), {
    message: 'Дата выезда должна быть позже даты заезда',
    path: ['checkOutDate'],
  });

export type NewReservationForm = z.infer<typeof newReservationSchema>;
export type NewReservationInput = z.input<typeof newReservationSchema>;
