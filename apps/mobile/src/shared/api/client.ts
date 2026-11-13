import { createBearerTokenClient } from '@gym/api-client';
import type { AuthFailureListener, TokenGetter } from '@gym/api-client';

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
  return createBearerTokenClient({ baseUrl, getAccessToken, onAuthFailure });
}
