import type { operations } from '@gym/api-client';

import { getApiUpstreamOrigin } from './upstream.mjs';

type Account = operations['UsersController_me']['responses'][200]['content']['application/json'];

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  role: Account['role'];
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
    ['ATHLETE', 'TRAINER', 'ADMIN'].includes(String(account.role))
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
        id: payload.id,
        email: payload.email,
        displayName: payload.profile?.displayName || payload.profile?.firstName || payload.email,
        role: payload.role,
      },
    };
  } catch {
    // No secrets, cookie material or backend errors are exposed to the browser.
    return { kind: 'unavailable' };
  }
}

export type ServerCapability = 'athlete' | 'trainer';

type PersistedCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

function isPersistedCapabilities(value: unknown): value is PersistedCapabilities {
  if (typeof value !== 'object' || value === null) return false;
  const grants = value as Record<string, unknown>;
  return (
    typeof grants.athlete === 'boolean' &&
    typeof grants.trainer === 'boolean' &&
    typeof grants.admin === 'boolean'
  );
}

/**
 * Only capability-gated server pages make this additional uncached request.
 * /users/me remains the source of legacy account display fields, while the
 * live grants endpoint (not User.role) decides entry to a trainer/athlete route.
 * The fixed upstream receives only the current request's Cookie header.
 */
export async function verifyServerCapability(
  cookieHeader: string,
  required: ServerCapability,
  upstream = getApiUpstreamOrigin(process.env.GYM_API_INTERNAL_URL),
  send: typeof fetch = fetch,
): Promise<ServerSessionResult> {
  const session = await verifyServerSession(cookieHeader, upstream, send);
  if (session.kind !== 'authenticated') return session;

  try {
    const response = await send(upstream + '/users/me/capabilities', {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status !== 200) return { kind: 'unavailable' };

    const grants: unknown = await response.json();
    if (!isPersistedCapabilities(grants)) return { kind: 'unavailable' };
    if (grants.admin || !grants[required]) return { kind: 'forbidden' };

    return session;
  } catch {
    return { kind: 'unavailable' };
  }
}
