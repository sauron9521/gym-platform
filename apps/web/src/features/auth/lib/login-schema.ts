import { z } from 'zod';

export type LoginValidationMessages = {
  emailRequired: string;
  emailInvalid: string;
  emailTooLong: string;
  passwordRequired: string;
  passwordWhitespace: string;
};

const defaultMessages: LoginValidationMessages = {
  emailRequired: 'Вкажіть електронну пошту.',
  emailInvalid: 'Вкажіть коректну електронну адресу.',
  emailTooLong: 'Електронна адреса занадто довга.',
  passwordRequired: 'Вкажіть пароль.',
  passwordWhitespace: 'Пароль не може складатися лише з пробілів.',
};

/** Client input checks only; API still owns authentication and throttling. */
export function createLoginSchema(messages: LoginValidationMessages = defaultMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid)
      .max(254, messages.emailTooLong),
    password: z
      .string()
      .min(1, messages.passwordRequired)
      .refine((value) => /\S/.test(value), messages.passwordWhitespace),
  });
}

export const loginSchema = createLoginSchema();
export type LoginValues = z.infer<typeof loginSchema>;
