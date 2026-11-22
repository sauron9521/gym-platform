import { validateStagingOrigin } from './staging-live-smoke.mjs';

const validScopes = new Set(['quick', 'idle-expiry', 'revoke-all']);

/**
 * Validate the protected GitHub admin-staging environment BEFORE the browser
 * accesses any staging credentials. No dispatch input may supply a target URL.
 */
export function validateAdminStagingTarget({
  origin,
  allowedHost,
  productionOrigin,
  scope,
  accountScope,
}) {
  const stagingOrigin = validateStagingOrigin(origin);
  if (origin !== stagingOrigin) {
    throw new Error('Admin staging origin must be an exact canonical HTTPS origin');
  }
  const hostname = new URL(stagingOrigin).hostname;
  if (!allowedHost || allowedHost !== hostname) {
    throw new Error('Admin staging host does not match the protected allowlist');
  }
  if (!productionOrigin || typeof productionOrigin !== 'string') {
    throw new Error('A production Admin origin is required for exclusion');
  }
  const production = new URL(productionOrigin);
  if (
    production.protocol !== 'https:' ||
    production.username ||
    production.password ||
    production.port ||
    production.search ||
    production.hash ||
    !production.hostname ||
    (production.pathname !== '/' && production.pathname !== '')
  ) {
    throw new Error('Production Admin exclusion must be an exact HTTPS origin');
  }
  if (productionOrigin !== production.origin) {
    throw new Error('Production Admin exclusion must be canonical');
  }
  if (production.origin === stagingOrigin || production.hostname === hostname) {
    throw new Error('Refusing to run staging browser smoke against production');
  }
  if (!validScopes.has(scope)) {
    throw new Error('Explicit quick, idle-expiry or revoke-all scope is required');
  }
  if (accountScope !== 'DEDICATED_STAGING_ONLY') {
    throw new Error('Require an explicitly dedicated staging-only Admin operator');
  }
  return { origin: stagingOrigin, scope };
}
