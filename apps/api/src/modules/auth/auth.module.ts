import { Module } from '@nestjs/common';
import { RateLimitStorageModule } from '#src/common/rate-limit/rate-limit-storage.module';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { UsersModule } from '#src/modules/users/users.module';
import { AuthController } from './controllers/auth.controller.js';
import { EmailVerificationController } from './controllers/email-verification.controller.js';
import { SessionsController } from './controllers/sessions.controller.js';

import { EmailVerificationMailer, PasswordResetMailer } from './mailers/index.js';
import { JwtAuth, SessionAuth } from './providers/index.js';
import { AdminSessionAuth } from './providers/admin-session-auth.provider.js';
import { AdminMfaSessionReader } from './stores/admin-mfa-session-reader.js';
import { AdminMfaChallengeService } from './services/admin-mfa-challenge.service.js';
import { AdminMfaReplacementService } from './services/admin-mfa-replacement.service.js';
import { AdminMfaRecoveryService } from './services/admin-mfa-recovery.service.js';
import { AdminMfaEnrollmentService } from './services/admin-mfa-enrollment.service.js';
import { AdminCookieAuthService } from './services/admin-cookie-auth.service.js';
import { AdminSessionFacade } from './services/admin-session.facade.js';
import { AdminSignInService } from './services/admin-sign-in.service.js';
import { AuthHttpQuotaFacade } from './services/auth-http-quota.facade.js';
import { VerificationResendRateLimitGuard } from './guards/verification-resend-rate-limit.guard.js';
import { CredentialsService, TokenCleanupService } from './services/index.js';
import { AuthAccountThrottleService } from './services/auth-account-throttle.service.js';
import { AuthCleanupLockService } from './services/auth-cleanup-lock.service.js';
import { PrismaMfaStore, PrismaSessionStore, PrismaTokenStore } from './stores/index.js';

@Module({
  imports: [UsersModule, RateLimitStorageModule],
  controllers: [AuthController, EmailVerificationController, SessionsController],
  providers: [
    AdminSessionPurposeGuard,
    AdminOriginGuard,
    AuthAccountThrottleService,
    VerificationResendRateLimitGuard,
    SessionAuth,
    AdminCookieAuthService,
    AdminSessionFacade,
    AdminSignInService,
    AuthHttpQuotaFacade,
    AdminMfaEnrollmentService,
    AdminMfaChallengeService,
    AdminMfaRecoveryService,
    AdminMfaReplacementService,
    AdminMfaSessionReader,
    AdminSessionAuth,
    CredentialsService,
    EmailVerificationMailer,
    JwtAuth,
    PasswordResetMailer,
    PrismaMfaStore,
    PrismaSessionStore,
    PrismaTokenStore,
    TokenCleanupService,
    AuthCleanupLockService,
  ],
  exports: [AdminSessionFacade, AdminSignInService, CredentialsService, AuthHttpQuotaFacade],
})
export class AuthModule {}
