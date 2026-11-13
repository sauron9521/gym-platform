import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { emailSchema } from '../dto/auth.schemas.js';
import {
  AuthAccountThrottleService,
  AUTH_ACCOUNT_THROTTLE_POLICIES,
} from '../services/auth-account-throttle.service.js';

export const RECOVERY_ACCOUNT_LIMIT = AUTH_ACCOUNT_THROTTLE_POLICIES.passwordRecovery.limit;
export const RECOVERY_ACCOUNT_TTL_MS = AUTH_ACCOUNT_THROTTLE_POLICIES.passwordRecovery.ttlMs;

/**
 * Secondary account-address throttle for forgot-password only, independent
 * from the existing IP throttle. No user lookup means identical handling of
 * registered and unregistered addresses.
 */
@Injectable()
export class AccountRecoveryRateLimitGuard implements CanActivate {
  constructor(private readonly accountThrottle: AuthAccountThrottleService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawEmail: unknown = request.body?.email;

    // Invalid requests are handled by DTO validation and the global IP limit.
    // Do not allocate arbitrary keys for malformed or oversized input.
    if (typeof rawEmail !== 'string') {
      return true;
    }

    // Use the same normalization and email validation as the HTTP request
    // schema. Guards run before pipes, so input is still the raw request body.
    // Padded but valid addresses must not bypass the quota.
    const parsed = emailSchema.safeParse({ email: rawEmail });
    if (!parsed.success || parsed.data.email.length > 254) {
      return true;
    }

    await this.accountThrottle.assertAllowed(
      parsed.data.email,
      AUTH_ACCOUNT_THROTTLE_POLICIES.passwordRecovery,
    );

    return true;
  }
}
