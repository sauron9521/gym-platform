import { z } from 'zod';

const INVALID_EMAIL = 'Вкажіть коректну електронну адресу.';
const INVALID_PASSWORD = 'Вкажіть пароль.';

/** Single source of truth for sign-in validation on iOS, Android and Expo Web. */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, { error: INVALID_EMAIL })
    .pipe(z.email({ error: INVALID_EMAIL })),
  // Do not trim passwords: leading/trailing spaces may be intentional.
  password: z.string().refine((value) => /\S/.test(value), {
    error: INVALID_PASSWORD,
  }),
});

export type SignInValues = z.infer<typeof signInSchema>;

export function getMobileLoginError(status: number): string {
  switch (status) {
    case 400:
      return 'Перевірте електронну адресу та пароль.';
    case 401:
      return 'Невірна електронна адреса або пароль.';
    case 403:
      return 'Доступ заборонено.';
    case 429:
      return 'Забагато спроб входу. Спробуйте пізніше.';
    default:
      return 'Не вдалося увійти. Спробуйте ще раз.';
  }
}

/** Do not show raw fetch errors: they may contain URLs or other sensitive details. */
export function getMobileLoginTransportError(stage: 'issue' | 'persist' | 'verify'): string {
  switch (stage) {
    case 'issue':
      return 'Не вдалося виконати запит входу до API. Перевірте адресу сервера, з’єднання та CORS (Expo Web).';
    case 'persist':
      return 'Не вдалося захищено зберегти сесію на пристрої.';
    case 'verify':
      return 'Не вдалося перевірити вхід через API. Перевірте з’єднання із сервером.';
  }
}

/** Keep the imperative auth API protected for callers outside React forms. */
export function validateMobileCredentials(email: string, password: string): string | null {
  const result = signInSchema.safeParse({ email, password });
  return result.success ? null : (result.error.issues[0]?.message ?? INVALID_EMAIL);
}
