export type AdminSession =
  | { kind: 'admin'; id: string }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

/**
 * Verify the caller with NestJS on every request, then enforce an ADMIN
 * role server-side. This is not a public client-side feature flag.
 */
export async function readAdminSession(
  cookieHeader: string,
  configured = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<AdminSession> {
  if (!cookieHeader) return { kind: 'unauthenticated' };
  if (!configured) return { kind: 'unavailable' };

  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.search ||
      url.hash
    ) {
      return { kind: 'unavailable' };
    }

    const response = await send(url.origin + '/users/me', {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status !== 200) return { kind: 'unavailable' };

    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return { kind: 'unavailable' };

    const user = body as Record<string, unknown>;
    if (typeof user.id !== 'string' || typeof user.role !== 'string') {
      return { kind: 'unavailable' };
    }
    if (user.role !== 'ADMIN') return { kind: 'forbidden' };

    return { kind: 'admin', id: user.id };
  } catch {
    return { kind: 'unavailable' };
  }
}
