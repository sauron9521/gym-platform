/**
 * Strict server-only API origin, independent of untrusted request data.
 * @param {string | undefined} configured
 */
export function getTrainerApiOrigin(configured) {
  if (!configured?.trim() && process.env.NODE_ENV === 'production') {
    throw new Error('Production Trainer requires GYM_API_INTERNAL_URL');
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
    throw new Error('Trainer API upstream must be a trusted HTTP(S) origin');
  }
  return url.origin;
}
