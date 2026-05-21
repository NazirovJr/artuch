/**
 * Shift open/close form schemas.
 */
import { z } from 'zod';
import { nonNegativeAmount, optionalText, optionalPinSchema } from './common';

export const shiftOpenSchema = z.object({
  openingCash: nonNegativeAmount,
});
export type ShiftOpenForm = z.infer<typeof shiftOpenSchema>;
export type ShiftOpenInput = z.input<typeof shiftOpenSchema>;

export const shiftCloseSchema = z.object({
  actualCash: nonNegativeAmount,
  notes: optionalText(500),
  // Manager PIN is conditional — required only when variance is large.
  // The screen's submit handler injects the proper validation by catching
  // the backend's "manager pin required" error and re-prompting.
  managerPin: optionalPinSchema,
});
export type ShiftCloseForm = z.infer<typeof shiftCloseSchema>;
export type ShiftCloseInput = z.input<typeof shiftCloseSchema>;
