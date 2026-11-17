import type { AppEnv } from './env.schema.js';

/** CORS_ORIGINS has already been validated as origin-only URLs by Zod. */
export function getCorsOrigins(origins: AppEnv['CORS_ORIGINS']): string[] {
  return origins.split(',').map((origin) => origin.trim());
}

/** Browser origins explicitly trusted for cookie-based mutations. */
export function getWebAppOrigin(appUrl: AppEnv['APP_URL']): string {
  return new URL(appUrl).origin;
}

export function getTrustedSessionOrigins(
  appUrl: AppEnv['APP_URL'],
  adminUrl?: AppEnv['ADMIN_APP_URL'],
): string[] {
  return [...new Set([getWebAppOrigin(appUrl), ...(adminUrl ? [getWebAppOrigin(adminUrl)] : [])])];
}
