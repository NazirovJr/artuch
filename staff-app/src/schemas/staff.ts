/**
 * Staff form schema — same shape for create and edit, but a `mode` flag
 * makes password required only on create. Edit forms send blank password
 * to mean "don't change".
 */
import { z } from 'zod';
import {
  emailSchema,
  optionalPasswordSchema,
  optionalPinSchema,
  passwordSchema,
  phoneSchema,
  requiredText,
  usernameSchema,
} from './common';

export const staffFormSchema = z
  .object({
    mode: z.enum(['create', 'edit']),
    username: usernameSchema,
    fullName: requiredText('ФИО'),
    roleId: z.string({ error: 'Выберите роль' }).min(1, 'Выберите роль'),
    password: optionalPasswordSchema,
    pin: optionalPinSchema,
    email: emailSchema,
    phone: phoneSchema,
    isActive: z.boolean(),
    outletIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'create') {
      // On create the password is mandatory; the optional schema would let
      // empty pass otherwise.
      const result = passwordSchema.safeParse(data.password);
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: result.error.issues[0]?.message ?? 'Пароль обязателен',
        });
      }
    }
  });

export type StaffForm = z.infer<typeof staffFormSchema>;
export type StaffFormInput = z.input<typeof staffFormSchema>;
