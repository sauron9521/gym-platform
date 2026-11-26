import { createBearerTokenClient } from '@gym/api-client';
import type { AuthFailureListener, TokenGetter } from '@gym/api-client';

import { mobileDiagnostics } from '../diagnostics/mobile-diagnostics';
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
  const send = globalThis.fetch;
  return createBearerTokenClient({
    baseUrl: validateMobileApiBaseUrl(baseUrl, production),
    getAccessToken,
    onAuthFailure,
    fetch: async (request) => {
      // The diagnostic port receives only response status and one validated ID.
      // Network rejection and authentication callbacks retain their existing behavior.
      const observe = mobileDiagnostics.beginApiResponseObservation();
      const response = await send(request);
      observe?.(response);
      return response;
    },
  });
}
