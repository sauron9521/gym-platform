import { describe, expect, it } from 'vitest';
import {
  MobileAccessDeniedError,
  MobileSessionExpiredError,
  isAccessDenied,
  isSessionExpired,
  shouldRetryMobileRead,
} from '../src/shared/api/api-error-policy.ts';

describe('mobile API error policy', () => {
  it('only invalidates the session for a real 401', () => {
    expect(isSessionExpired(401)).toBe(true);
    for (const status of [0, 403, 408, 429, 500, 503]) {
      expect(isSessionExpired(status)).toBe(false);
    }
    expect(isAccessDenied(403)).toBe(true);
    expect(isAccessDenied(401)).toBe(false);
  });

  it('retries ordinary reads once but never auth/permission errors', () => {
    expect(shouldRetryMobileRead(0, new Error('offline'))).toBe(true);
    expect(shouldRetryMobileRead(1, new Error('offline'))).toBe(false);
    expect(shouldRetryMobileRead(0, new MobileSessionExpiredError())).toBe(false);
    expect(shouldRetryMobileRead(0, new MobileAccessDeniedError())).toBe(false);
  });
});
