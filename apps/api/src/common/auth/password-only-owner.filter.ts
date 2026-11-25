import type { Prisma } from '#prisma/client';

/**
 * A confirmed factor must never fall back to password-only credentials, even
 * when the authentication library's MFA feature is not configured. Explicit
 * relation branches preserve access for absent and unconfirmed factors.
 */
export const PASSWORD_ONLY_OWNER_FILTER = {
  OR: [{ mfaAuthenticator: { is: null } }, { mfaAuthenticator: { is: { confirmed: false } } }],
} satisfies Prisma.UserWhereInput;
