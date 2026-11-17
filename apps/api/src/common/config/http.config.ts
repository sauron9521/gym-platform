import type { AppEnv } from './env.schema.js';

/** CORS_ORIGINS has already been validated as origin-only URLs by Zod. */
export function getCorsOrigins(origins: AppEnv['CORS_ORIGINS']): string[] {
  return origins.split(',').map((origin) => origin.trim());
}

/** The primary browser session origin for auth cookies and email links. */
export function getWebAppOrigin(appUrl: AppEnv['APP_URL']): string {
  return new URL(appUrl).origin;
}

/**
 * A permitted cross-origin SPA must pass both CORS and Nest's CSRF origin check.
 * Use only explicitly configured origin-only URLs (validated by env.schema).
 * This does not change the session-cookie trusted origins in AppModule.
 */
export function getCsrfTrustedOrigins(
  appUrl: AppEnv['APP_URL'],
  corsOrigins: string[],
  adminUrl?: AppEnv['ADMIN_APP_URL'],
): string[] {
  return [
    ...new Set([
      getWebAppOrigin(appUrl),
      ...corsOrigins,
      ...(adminUrl ? [new URL(adminUrl).origin] : []),
    ]),
  ];
}

/** Session-origin trust is intentionally narrower than the cross-origin API CSRF allowlist. */
export function getSessionTrustedOrigins(
  appUrl: AppEnv['APP_URL'],
  adminUrl?: AppEnv['ADMIN_APP_URL'],
): string[] {
  return [...new Set([getWebAppOrigin(appUrl), ...(adminUrl ? [new URL(adminUrl).origin] : [])])];
}
