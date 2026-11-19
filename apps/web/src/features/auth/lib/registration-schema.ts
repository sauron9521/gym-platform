import { z } from 'zod';

export type RegistrationValidationMessages = {
  emailRequired: string;
  emailInvalid: string;
  emailTooLong: string;
  passwordMinLength: string;
  passwordWhitespace: string;
  passwordConfirmation: string;
  passwordMismatch: string;
};

const defaultMessages: RegistrationValidationMessages = {
  emailRequired: 'Вкажіть електронну пошту.',
  emailInvalid: 'Вкажіть коректну електронну адресу.',
  emailTooLong: 'Електронна адреса занадто довга.',
  passwordMinLength: 'Пароль має містити щонайменше 8 символів.',
  passwordWhitespace: 'Пароль не може складатися лише з пробілів.',
  passwordConfirmation: 'Повторіть пароль.',
  passwordMismatch: 'Паролі не збігаються.',
};

/** Client hints only; NestJS owns password strength, uniqueness and rate limits. */
export function createRegistrationSchema(
  messages: RegistrationValidationMessages = defaultMessages,
) {
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, messages.emailRequired)
        .email(messages.emailInvalid)
        .max(254, messages.emailTooLong),
      password: z
        .string()
        .min(8, messages.passwordMinLength)
        .refine((value) => /\S/.test(value), messages.passwordWhitespace),
      confirmation: z.string().min(1, messages.passwordConfirmation),
    })
    .refine((values) => values.password === values.confirmation, {
      message: messages.passwordMismatch,
      path: ['confirmation'],
    });
}

export const registrationSchema = createRegistrationSchema();
export type RegistrationValues = z.infer<typeof registrationSchema>;
