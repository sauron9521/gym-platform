import { z } from 'zod';

/** Client-side input checks only. The API still owns authentication and throttling. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Вкажіть електронну пошту.')
    .email('Вкажіть коректну електронну адресу.')
    .max(254, 'Електронна адреса занадто довга.'),
  password: z
    .string()
    .min(1, 'Вкажіть пароль.')
    .refine((value) => /\S/.test(value), 'Пароль не може складатися лише з пробілів.'),
});

export type LoginValues = z.infer<typeof loginSchema>;
