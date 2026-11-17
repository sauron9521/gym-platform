import { describe, expect, it } from 'vitest';

import {
  MobileAccessDeniedError,
  MobileReadHttpError,
  MobileSessionExpiredError,
  isAccessDenied,
  isSessionExpired,
  mobileReadError,
  shouldRetryMobileRead,
} from '../src/shared/api/api-error-policy.ts';

describe('mobile API error policy', () => {
  it('expires authentication only for a real 401, never for 403 or network errors', () => {
    expect(isSessionExpired(401)).toBe(true);
    for (const status of [0, 400, 403, 404, 408, 429, 500, 503]) {
      expect(isSessionExpired(status)).toBe(false);
    }
    expect(isAccessDenied(403)).toBe(true);
    expect(isAccessDenied(401)).toBe(false);
  });

  it('maps 403 to access denied without losing status for other responses', () => {
    expect(mobileReadError(403, 'Fallback')).toBeInstanceOf(MobileAccessDeniedError);
    expect(mobileReadError(404, 'Not found')).toMatchObject({
      name: 'MobileReadHttpError',
      status: 404,
      message: 'Not found',
    });
  });

  it('never retries rejected credentials, forbidden, or non-transient 4xx', () => {
    expect(shouldRetryMobileRead(0, new MobileSessionExpiredError())).toBe(false);
    expect(shouldRetryMobileRead(0, new MobileAccessDeniedError())).toBe(false);
    for (const status of [400, 404, 409, 422]) {
      const error = new MobileReadHttpError(status, 'Client error');
      expect(shouldRetryMobileRead(0, error)).toBe(false);
    }
    const aborted = new Error('Request cancelled');
    aborted.name = 'AbortError';
    expect(shouldRetryMobileRead(0, aborted)).toBe(false);
  });

  it('retries network failures, 408/429 and server errors only once', () => {
    expect(shouldRetryMobileRead(0, new Error('offline'))).toBe(true);
    expect(shouldRetryMobileRead(1, new Error('offline'))).toBe(false);

    for (const status of [408, 429, 500, 503]) {
      const failure = new MobileReadHttpError(status, 'Temporary error');
      expect(shouldRetryMobileRead(0, failure)).toBe(true);
      expect(shouldRetryMobileRead(1, failure)).toBe(false);
    }
  });
});
