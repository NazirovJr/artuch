/**
 * Cleaning request form schema — admin/owner/manager raising a housekeeping
 * task for a room. roomNumber is the picker's string value (converted to a
 * number on submit); assignee is optional (otherwise the task is unassigned).
 */
import { z } from 'zod';
import { optionalText } from './common';

export const cleaningRequestSchema = z.object({
  roomNumber: z
    .string({ error: 'Выберите номер' })
    .min(1, 'Выберите номер'),
  type: z.enum(['departure', 'stayover', 'deep', 'inspection']),
  assignedTo: optionalText(60),
});

export type CleaningRequestForm = z.infer<typeof cleaningRequestSchema>;
export type CleaningRequestFormInput = z.input<typeof cleaningRequestSchema>;
