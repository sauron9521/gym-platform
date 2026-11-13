import { createBrowserSessionClient } from '@gym/api-client';
import type { AuthFailureListener } from '@gym/api-client';

/**
 * Browser-only API client. HttpOnly session cookies are managed by the browser.
 * Do not use this singleton in Next.js Server Components or route handlers:
 * a server-side fetch does not implicitly forward a user's cookies.
 */
export function createWebSessionApi(onAuthFailure?: AuthFailureListener) {
  return createBrowserSessionClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    onAuthFailure,
  });
}

export const webApi = createWebSessionApi();
