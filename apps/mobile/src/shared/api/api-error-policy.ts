/**
 * One transport-neutral error policy for authenticated read queries.
 * Do not sign out for 403, network failures or server errors.
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

export function isSessionExpired(status: number): boolean {
  return status === 401;
}

export function isAccessDenied(status: number): boolean {
  return status === 403;
}

/** No repeat of a rejected login/session, and never retry a mutation by default. */
export function shouldRetryMobileRead(failureCount: number, error: Error): boolean {
  return (
    failureCount < 1 &&
    !(error instanceof MobileSessionExpiredError) &&
    !(error instanceof MobileAccessDeniedError)
  );
}
