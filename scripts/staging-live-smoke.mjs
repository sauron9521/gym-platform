/**
 * Read-only live staging health smoke. Never sends credentials or mutates state.
 * The operator supplies an explicit HTTPS origin in a manual GitHub run.
 */
export function validateStagingOrigin(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('An explicit STAGING_API_URL is required.');
  }
  const url = new URL(input);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.port
  ) {
    throw new Error('STAGING_API_URL must be an HTTPS origin without credentials or path.');
  }
  const host = url.hostname.toLowerCase();
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.test') ||
    host.endsWith('.invalid') ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host.includes(':') ||
    !host.split('.').includes('staging')
  ) {
    throw new Error('STAGING_API_URL must use a public DNS hostname with a staging subdomain.');
  }
  return url.origin;
}

export async function checkStagingHealth(origin, send = fetch) {
  const stagingOrigin = validateStagingOrigin(origin);
  for (const path of ['/health/live', '/health/ready']) {
    const response = await send(stagingOrigin + path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json' },
    });
    if (response.status !== 200) {
      throw new Error(path + ' returned HTTP ' + response.status);
    }
    const body = await response.json();
    if (!body || typeof body !== 'object' || body.status !== 'ok') {
      throw new Error(path + ' returned an invalid health response');
    }
  }
  return true;
}

if (process.argv[1]?.endsWith('/staging-live-smoke.mjs')) {
  const origin = validateStagingOrigin(process.env.STAGING_API_URL);
  await checkStagingHealth(origin);
  console.log('Live staging liveness and readiness passed for ', origin);
  console.log('This is NOT production approval or proof of user-journey completion.');
}
