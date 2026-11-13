import { z } from 'zod';

/** Client hints only; NestJS enforces password strength, email uniqueness and rate limits. */
export const registrationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Вкажіть електронну пошту.')
      .email('Вкажіть коректну електронну адресу.')
      .max(254, 'Електронна адреса занадто довга.'),
    password: z
      .string()
      .min(8, 'Пароль має містити щонайменше 8 символів.')
      .refine((value) => /\S/.test(value), 'Пароль не може складатися лише з пробілів.'),
    confirmation: z.string().min(1, 'Повторіть пароль.'),
  })
  .refine((values) => values.password === values.confirmation, {
    message: 'Паролі не збігаються.',
    path: ['confirmation'],
  });

export type RegistrationValues = z.infer<typeof registrationSchema>;
