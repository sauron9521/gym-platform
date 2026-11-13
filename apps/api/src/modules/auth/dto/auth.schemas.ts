import { z } from 'zod';

import { normalizeRecoveryEmail } from '../utils/normalize-recovery-email.js';

// Keep the current credential requirements while migrating Auth from
// decorator-based DTOs to Nest 12's Standard Schema validation.
const credentialsEmailSchema = z.email();

const signInPasswordSchema = z
  .string()
  .min(1)
  .regex(/\S/, 'Password must contain at least one non-whitespace character')
  .meta({ writeOnly: true });

// Match class-validator's default IsStrongPassword constraints:
// 8+ characters and at least one lower, upper, number and symbol.
const strongPasswordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a symbol')
  .meta({ writeOnly: true });

const tokenSchema = z.string().min(1).meta({ writeOnly: true });

// Only the recovery email was normalized by the previous DTO.
// Do not alter login/registration identity semantics as a side effect.
const recoveryEmailSchema = z
  .string()
  .transform(normalizeRecoveryEmail)
  .pipe(z.email());

export const signInSchema = z.strictObject({
  email: credentialsEmailSchema,
  password: signInPasswordSchema,
});

export const signUpSchema = z.strictObject({
  email: credentialsEmailSchema,
  password: strongPasswordSchema,
});

export const emailSchema = z.strictObject({
  email: recoveryEmailSchema,
});

export const verificationTokenSchema = z.strictObject({
  token: tokenSchema,
});

export const resetPasswordSchema = z.strictObject({
  token: tokenSchema,
  password: strongPasswordSchema,
});

export const refreshTokenSchema = z.strictObject({
  refreshToken: tokenSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type VerificationTokenInput = z.infer<typeof verificationTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
