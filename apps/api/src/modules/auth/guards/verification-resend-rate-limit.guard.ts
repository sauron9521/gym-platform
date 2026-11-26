import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { VerificationResendActor } from '../types/verification-resend-actor.js';
import { AUTH_ACCOUNT_THROTTLE_POLICIES } from '../services/auth-account-throttle.service.js';
import { AuthHttpQuotaFacade } from '../services/auth-http-quota.facade.js';

export const VERIFICATION_RESEND_USER_LIMIT =
  AUTH_ACCOUNT_THROTTLE_POLICIES.verificationResend.limit;
export const VERIFICATION_RESEND_USER_TTL_MS =
  AUTH_ACCOUNT_THROTTLE_POLICIES.verificationResend.ttlMs;

type AuthenticatedRequest = Request & {
  user?: Pick<VerificationResendActor, 'id' | 'emailVerified'>;
};

/**
 * A second quota for authenticated verification resends, independent of
 * client IP or active session. The normal auth and IP guards still run.
 */
@Injectable()
export class VerificationResendRateLimitGuard implements CanActivate {
  constructor(private readonly accountThrottle: AuthHttpQuotaFacade) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // This endpoint is authenticated. Never allocate anonymous/empty keys.
    if (typeof user?.id !== 'string' || !user.id) {
      throw new UnauthorizedException();
    }

    // Preserve the controller's existing 409 for already-verified users.
    // Only unverified users can generate verification emails.
    if (user.emailVerified) {
      return true;
    }

    await this.accountThrottle.assertVerificationResend(user.id);

    return true;
  }
}
