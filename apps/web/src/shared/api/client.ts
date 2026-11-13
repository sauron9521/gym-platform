import { createBrowserSessionClient } from '@gym/api-client';
import type { AuthFailureListener } from '@gym/api-client';

/**
 * Browser-only API client. HttpOnly session cookies are managed by the browser.
 * Requests use the same-origin /backend rewrite. Server Components must use
 * server-session.ts and explicitly forward the incoming request cookies.
 */
export function createWebSessionApi(onAuthFailure?: AuthFailureListener) {
  return createBrowserSessionClient({
    baseUrl: '/backend',
    onAuthFailure,
  });
}

export const webApi = createWebSessionApi();
