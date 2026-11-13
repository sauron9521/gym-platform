/**
 * A fixed, trusted API origin. Never derive the proxy destination from user input.
 * @param {string | undefined} configured
 */
export function getApiUpstreamOrigin(configured) {
  const url = new URL(configured ?? 'http://localhost:3001');

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('GYM_API_INTERNAL_URL must be an HTTP(S) origin without credentials or path');
  }

  return url.origin;
}
