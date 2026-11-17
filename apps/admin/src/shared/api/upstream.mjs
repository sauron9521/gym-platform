/**
 * Resolve a single server-configured NestJS API origin.
 * Untrusted browser input can never influence the rewrite destination.
 * @param {string | undefined} configured
 */
export function getAdminApiOrigin(configured) {
  if (!configured?.trim() && process.env.NODE_ENV === 'production') {
    throw new Error('GYM_API_INTERNAL_URL is required for the production Admin');
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
