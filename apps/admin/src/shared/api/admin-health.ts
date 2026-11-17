import { getAdminApiOrigin } from './upstream.mjs';

export type AdminHealth = 'healthy' | 'degraded';

/**
 * Readiness is public and deliberately unauthenticated, but the dashboard
 * calls this only after server-side ADMIN session verification.
 * This is one uncached point-in-time signal, not metrics or uptime evidence.
 */
export async function readAdminHealth(
  configured = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<AdminHealth> {
  if (!configured?.trim()) return 'degraded';

  try {
    const origin = getAdminApiOrigin(configured);
    const response = await send(origin + '/health/ready', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status !== 200) return 'degraded';

    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'degraded';
    return (body as Record<string, unknown>).status === 'ok' ? 'healthy' : 'degraded';
  } catch {
    // Never reveal the private API origin, error response, or network details.
    return 'degraded';
  }
}
