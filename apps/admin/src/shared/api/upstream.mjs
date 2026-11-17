/**
 * Fixed server-side NestJS upstream; no browser-provided input can alter the rewrite.
 * @param {string | undefined} configured
 */
export function getAdminApiOrigin(configured) {
  if (!configured?.trim() && process.env.NODE_ENV === 'production') {
    throw new Error('Production Admin requires GYM_API_INTERNAL_URL');
  }
  const url = new URL(configured?.trim() || 'http://localhost:3001');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('Admin API upstream must be a trusted HTTP(S) origin');
  }
  return url.origin;
}
