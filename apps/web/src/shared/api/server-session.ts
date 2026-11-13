import type { operations } from '@gym/api-client';

import { getApiUpstreamOrigin } from './upstream.mjs';

type Account = operations['UsersController_me']['responses'][200]['content']['application/json'];

export type AuthenticatedUser = {
  email: string;
  displayName: string;
};

export type ServerSessionResult =
  | { kind: 'authenticated'; user: AuthenticatedUser }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false;
  const account = value as Record<string, unknown>;
  return (
    typeof account.id === 'string' &&
    typeof account.email === 'string' &&
    typeof account.role === 'string'
  );
}

/**
 * Server-only HTTP request. Forward just the incoming Cookie header to the
 * fixed API upstream. Never reuse the browser singleton or cache private data.
 * A cookie's existence alone does not grant access.
 */
export async function verifyServerSession(
  cookieHeader: string,
  upstream = getApiUpstreamOrigin(process.env.GYM_API_INTERNAL_URL),
  send: typeof fetch = fetch,
): Promise<ServerSessionResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };

  try {
    const response = await send(upstream + '/users/me', {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status !== 200) return { kind: 'unavailable' };

    const payload: unknown = await response.json();
    if (!isAccount(payload)) return { kind: 'unavailable' };

    return {
      kind: 'authenticated',
      user: {
        email: payload.email,
        displayName: payload.profile?.displayName || payload.profile?.firstName || payload.email,
      },
    };
  } catch {
    // No secrets, cookie material or backend errors are exposed to the browser.
    return { kind: 'unavailable' };
  }
}
