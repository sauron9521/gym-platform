/**
 * A fixed, trusted API origin. Never derive the proxy destination from user input.
 * @param {string | undefined} configured
 */
export function getApiUpstreamOrigin(
  configured,
  { requireConfigured = process.env.NODE_ENV === 'production' } = {},
) {
  // Development and fixture tests may use localhost, never an implicit
  // production upstream. An empty string is also a missing configuration.
  if (requireConfigured && !configured?.trim()) {
    throw new Error('GYM_API_INTERNAL_URL must be explicitly configured in production');
  }
  const url = new URL(configured?.trim() || 'http://localhost:3001');

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
