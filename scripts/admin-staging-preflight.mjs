import { validateAdminStagingTarget } from './admin-staging-target.mjs';

/**
 * Read-only, anonymous HTTPS preflight of the deployed Admin reverse proxy.
 * This intentionally does not receive account credentials, database URLs, or
 * production secrets. Never follow redirects or send cookies.
 */
export async function checkAdminStagingPreflight(settings, send = fetch) {
  const { origin } = validateAdminStagingTarget(settings);
  const checks = [
    { path: '/sign-in', status: 200, contentType: 'text/html' },
    { path: '/backend/health/live', status: 200, json: true },
    { path: '/backend/health/ready', status: 200, json: true },
    { path: '/backend/auth/admin-session', status: 401 },
  ];
  for (const check of checks) {
    const response = await send(origin + check.path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: check.contentType ?? 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.url && response.url !== origin + check.path) {
      throw new Error(check.path + ' resolved outside the requested staging origin');
    }
    if (response.status !== check.status) {
      throw new Error(
        check.path + ' returned HTTP ' + response.status + ', expected ' + check.status,
      );
    }
    if (
      check.contentType &&
      !response.headers?.get('content-type')?.toLowerCase().includes(check.contentType)
    ) {
      throw new Error(check.path + ' did not return HTML');
    }
    if (check.json) {
      const payload = await response.json();
      if (!payload || typeof payload !== 'object' || payload.status !== 'ok') {
        throw new Error(check.path + ' returned an unhealthy response');
      }
    }
  }
  return true;
}

// Staging address originates only from protected GitHub Environment variables,
// never from workflow_dispatch URL fields. No staging email/password is read.
if (process.argv[1]?.endsWith('/admin-staging-preflight.mjs')) {
  await checkAdminStagingPreflight({
    origin: process.env.ADMIN_STAGING_ORIGIN,
    allowedHost: process.env.ADMIN_STAGING_ALLOWED_HOST,
    productionOrigin: process.env.ADMIN_PRODUCTION_ORIGIN,
    scope: process.env.ADMIN_STAGING_SCOPE,
    accountScope: process.env.ADMIN_STAGING_ACCOUNT_SCOPE,
  });
  console.log('Anonymous external Admin staging TLS/proxy preflight succeeded.');
  console.log('This does not validate login, expiry, revocation or production readiness.');
}
