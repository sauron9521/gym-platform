export type AdminHealth = 'healthy' | 'degraded';

/**
 * Public readiness probe is invoked only after AdminHomePage has verified ADMIN
 * rights on the server. Never make dashboard access depend on this probe alone.
 */
export async function readAdminHealth(
  configured = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<AdminHealth> {
  if (!configured) return 'degraded';

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
      return 'degraded';
    }

    const result = await send(url.origin + '/health/ready', {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (result.status !== 200) return 'degraded';
    const body: unknown = await result.json();
    return body && typeof body === 'object' && 'status' in body && body.status === 'ok'
      ? 'healthy'
      : 'degraded';
  } catch {
    // Never reveal internal API addresses, credentials or stack traces.
    return 'degraded';
  }
}
