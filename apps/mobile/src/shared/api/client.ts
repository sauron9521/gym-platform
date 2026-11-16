import { createBearerTokenClient } from '@gym/api-client';
import type { AuthFailureListener, TokenGetter } from '@gym/api-client';

/**
 * Reject plaintext transport of refresh/access tokens in release bundles.
 * Expo defines __DEV__; Node-based unit tests can pass an explicit mode.
 */
export function validateMobileApiBaseUrl(
  baseUrl: string,
  production =
    typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production',
): string {
  const url = new URL(baseUrl);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Mobile API URL must be an HTTP(S) endpoint without credentials');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('Mobile release builds require HTTPS for API tokens');
  }
  return baseUrl;
}

/**
 * Native/API token adapter. Access tokens come from a caller-provided reader.
 * Secure token storage and refresh lifecycle are implemented separately.
 * A physical device must receive a host-reachable base URL, not localhost.
 */
export function createMobileApi(
  baseUrl: string,
  getAccessToken: TokenGetter,
  onAuthFailure?: AuthFailureListener,
) {
  return createBearerTokenClient({ baseUrl: validateMobileApiBaseUrl(baseUrl), getAccessToken, onAuthFailure });
}
