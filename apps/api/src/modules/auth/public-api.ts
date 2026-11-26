// Explicit injected Auth contracts. No store, registry, or raw cookie issuer exports.
export { AdminSessionFacade } from './services/admin-session.facade.js';
export { AdminSignInService } from './services/admin-sign-in.service.js';
export { CredentialsService } from './services/credentials.service.js';
export { AuthHttpQuotaFacade } from './services/auth-http-quota.facade.js';

// HTTP validation and transport policies; keep existing implementations and metadata.
export {
  signInSchema,
  signUpSchema,
  emailSchema,
  verificationTokenSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  type SignInInput,
  type SignUpInput,
  type EmailInput,
  type VerificationTokenInput,
  type ResetPasswordInput,
  type RefreshTokenInput,
} from './dto/auth.schemas.js';
export { AccountRecoveryRateLimitGuard } from './guards/account-recovery-rate-limit.guard.js';
export { VerificationResendRateLimitGuard } from './guards/verification-resend-rate-limit.guard.js';
export { AuthNoStoreInterceptor } from './interceptors/auth-no-store.interceptor.js';
export { AuthNoStoreMiddleware } from './middleware/auth-no-store.middleware.js';
export type { VerificationResendActor } from './types/verification-resend-actor.js';
