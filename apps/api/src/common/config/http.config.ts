import type { AppEnv } from './env.schema.js';

/** CORS_ORIGINS has already been validated as origin-only URLs by Zod. */
export function getCorsOrigins(origins: AppEnv['CORS_ORIGINS']): string[] {
  return origins.split(',').map((origin) => origin.trim());
}

/** The browser app is the only additional trusted origin for cookie-based writes. */
export function getWebAppOrigin(appUrl: AppEnv['APP_URL']): string {
  return new URL(appUrl).origin;
}
