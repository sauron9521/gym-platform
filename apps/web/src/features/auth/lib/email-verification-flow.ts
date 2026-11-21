/** Translate status-derived keys only; never render untrusted API error bodies. */
export function getVerificationErrorKey(
  status: number,
): 'invalidToken' | 'forbidden' | 'rateLimited' | 'verificationFailed' {
  switch (status) {
    case 400:
      return 'invalidToken';
    case 403:
      return 'forbidden';
    case 429:
      return 'rateLimited';
    default:
      return 'verificationFailed';
  }
}

export function getResendErrorKey(
  status: number,
):
  | 'signInRequired'
  | 'forbidden'
  | 'alreadyVerified'
  | 'resendRateLimited'
  | 'mailUnavailable'
  | 'resendFailed' {
  switch (status) {
    case 401:
      return 'signInRequired';
    case 403:
      return 'forbidden';
    case 409:
      return 'alreadyVerified';
    case 429:
      return 'resendRateLimited';
    case 503:
      return 'mailUnavailable';
    default:
      return 'resendFailed';
  }
}

/** Avoid passing malformed and arbitrarily long tokens to the API. */
export function getVerificationToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048 ? value : null;
}
