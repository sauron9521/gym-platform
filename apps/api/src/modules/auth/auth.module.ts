import { Module } from '@nestjs/common';
import { RateLimitStorageModule } from '#src/common/rate-limit/rate-limit-storage.module';
import { AdminSessionPurposeGuard } from '#src/common/auth/admin-session-purpose.guard';
import { AdminOriginGuard } from '#src/common/auth/admin-origin.guard';
import { UsersModule } from '#src/modules/users/users.module';
import { AuthController } from './controllers/auth.controller.js';
import { EmailVerificationController } from './controllers/email-verification.controller.js';
import { PasswordResetController } from './controllers/password-reset.controller.js';
import { SessionsController } from './controllers/sessions.controller.js';
import { TokensController } from './controllers/tokens.controller.js';

import { EmailVerificationMailer, PasswordResetMailer } from './mailers/index.js';
import { JwtAuth, SessionAuth } from './providers/index.js';
import { AccountRecoveryRateLimitGuard } from './guards/account-recovery-rate-limit.guard.js';
import { VerificationResendRateLimitGuard } from './guards/verification-resend-rate-limit.guard.js';
import { CredentialsService, TokenCleanupService } from './services/index.js';
import { AuthAccountThrottleService } from './services/auth-account-throttle.service.js';
import { AuthCleanupLockService } from './services/auth-cleanup-lock.service.js';
import { PrismaSessionStore, PrismaTokenStore } from './stores/index.js';

@Module({
  imports: [UsersModule, RateLimitStorageModule],
  controllers: [
    AuthController,
    PasswordResetController,
    EmailVerificationController,
    TokensController,
    SessionsController,
  ],
  providers: [
    AdminSessionPurposeGuard,
    AdminOriginGuard,
    AuthAccountThrottleService,
    AccountRecoveryRateLimitGuard,
    VerificationResendRateLimitGuard,
    SessionAuth,
    CredentialsService,
    EmailVerificationMailer,
    JwtAuth,
    PasswordResetMailer,
    PrismaSessionStore,
    PrismaTokenStore,
    TokenCleanupService,
    AuthCleanupLockService,
  ],
})
export class AuthModule {}
