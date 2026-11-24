import { getAdminApiOrigin } from './upstream.mjs';
import type { DirectoryRow } from './admin-directory';

type AdminUserDetail = DirectoryRow & {
  emailVerified: boolean;
  updatedAt: string;
};

export type AdminUserDetailResult =
  | { kind: 'ready'; user: AdminUserDetail }
  | { kind: 'unauthenticated' | 'forbidden' | 'not-found' | 'unavailable' | 'invalid' };

export const accountIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const expectedKeys = ['id', 'email', 'role', 'status', 'createdAt', 'emailVerified', 'updatedAt'];

function parseDetail(raw: unknown, id: string): AdminUserDetail | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).length !== expectedKeys.length ||
    !expectedKeys.every((key) => Object.hasOwn(value, key)) ||
    value.id !== id ||
    typeof value.email !== 'string' ||
    value.email.length > 320 ||
    !value.email.includes('@') ||
    (value.role !== 'ATHLETE' && value.role !== 'TRAINER' && value.role !== 'ADMIN') ||
    (value.status !== 'ACTIVE' && value.status !== 'SUSPENDED') ||
    typeof value.emailVerified !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.updatedAt))
  ) {
    return null;
  }
  return {
    id,
    email: value.email,
    role: value.role,
    status: value.status as 'ACTIVE' | 'SUSPENDED',
    emailVerified: value.emailVerified,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

/** Server-only read; caller must verify Admin session first. API checks Super Admin again. */
export async function readAdminUserDetail(
  cookieHeader: string,
  id: string,
  configured = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<AdminUserDetailResult> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!accountIdPattern.test(id)) return { kind: 'invalid' };
  if (!configured?.trim()) return { kind: 'unavailable' };

  try {
    const origin = getAdminApiOrigin(configured);
    const response = await send(origin + '/admin/users/' + id, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 404) return { kind: 'not-found' };
    if (response.status !== 200) return { kind: 'unavailable' };

    const user = parseDetail(await response.json(), id);
    return user ? { kind: 'ready', user } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
