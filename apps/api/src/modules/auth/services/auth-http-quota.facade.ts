import { Injectable } from '@nestjs/common';

import {
  AuthAccountThrottleService,
  AUTH_ACCOUNT_THROTTLE_POLICIES,
} from './auth-account-throttle.service.js';

/** Fixed public HTTP quota operations; callers cannot select arbitrary policies. */
@Injectable()
export class AuthHttpQuotaFacade {
  constructor(private readonly throttle: AuthAccountThrottleService) {}

  assertPasswordRecovery(normalizedEmail: string): Promise<void> {
    return this.throttle.assertAllowed(
      normalizedEmail,
      AUTH_ACCOUNT_THROTTLE_POLICIES.passwordRecovery,
    );
  }

  assertVerificationResend(userId: string): Promise<void> {
    return this.throttle.assertAllowed(userId, AUTH_ACCOUNT_THROTTLE_POLICIES.verificationResend);
  }
}
