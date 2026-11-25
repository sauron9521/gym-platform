import { z } from 'zod';
import type { MobileAuthErrorCode } from '../../../shared/i18n/mobile-messages';

const INVALID_EMAIL = 'invalidEmail';
const INVALID_PASSWORD = 'invalidPassword';

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

export function getMobileLoginError(status: number): MobileAuthErrorCode {
  switch (status) {
    case 400:
      return 'invalidRequest';
    case 401:
      return 'invalidCredentials';
    case 403:
      return 'accessDenied';
    case 429:
      return 'throttled';
    default:
      return 'failed';
  }
}

/** Do not show raw fetch errors: they may contain URLs or other sensitive details. */
export function getMobileLoginTransportError(
  stage: 'issue' | 'persist' | 'verify',
): MobileAuthErrorCode {
  switch (stage) {
    case 'issue':
      return 'connectionFailed';
    case 'persist':
      return 'storageFailed';
    case 'verify':
      return 'verificationFailed';
  }
}

/** Keep the imperative auth API protected for callers outside React forms. */
export function validateMobileCredentials(
  email: string,
  password: string,
): MobileAuthErrorCode | null {
  const result = signInSchema.safeParse({ email, password });
  if (result.success) return null;
  return result.error.issues[0]?.path[0] === 'password' ? INVALID_PASSWORD : INVALID_EMAIL;
}
