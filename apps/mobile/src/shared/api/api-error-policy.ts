/**
 * Read-query policy for authenticated mobile API calls.
 * 401 may expire a session; 403 and temporary network/server errors never sign out.
 */
export class MobileSessionExpiredError extends Error {
  constructor(message = 'Термін сесії минув. Увійдіть повторно.') {
    super(message);
    this.name = 'MobileSessionExpiredError';
  }
}

export class MobileAccessDeniedError extends Error {
  constructor() {
    super('Недостатньо прав для виконання дії.');
    this.name = 'MobileAccessDeniedError';
  }
}

export class MobileReadHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MobileReadHttpError';
  }
}

export function isSessionExpired(status: number): boolean {
  return status === 401;
}

export function isAccessDenied(status: number): boolean {
  return status === 403;
}

/** Preserve status semantics instead of repeatedly retrying a forbidden response. */
export function mobileReadError(status: number, message: string): Error {
  return isAccessDenied(status)
    ? new MobileAccessDeniedError()
    : new MobileReadHttpError(status, message);
}

/** At most one retry for network failures, 408/429, and 5xx. No retry for other 4xx. */
export function shouldRetryMobileRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || error instanceof MobileSessionExpiredError) return false;
  if (error instanceof MobileAccessDeniedError) return false;
  if (error instanceof Error && error.name === 'AbortError') return false;

  if (error instanceof MobileReadHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}
