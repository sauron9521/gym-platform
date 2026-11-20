import { createBearerTokenClient } from '@gym/api-client';
import type { AuthFailureListener, TokenGetter } from '@gym/api-client';

import { validateMobileApiBaseUrl } from './validate-mobile-api-url';

// Metro defines this at runtime; Node/Playwright cross-product checks do not.
declare const __DEV__: boolean;

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
  const production =
    typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production';
  return createBearerTokenClient({
    baseUrl: validateMobileApiBaseUrl(baseUrl, production),
    getAccessToken,
    onAuthFailure,
  });
}
