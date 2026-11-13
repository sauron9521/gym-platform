import createClient from 'openapi-fetch';

import type { paths } from './generated/schema.js';

/**
 * Fully typed, fetch-based Gym API client.
 *
 * The caller controls baseUrl, credentials, fetch and optional auth headers.
 * No token persistence, globals or implicit authentication are configured here.
 */
export function createGymApiClient(options: Parameters<typeof createClient<paths>>[0]) {
  return createClient<paths>(options);
}

export type GymApiClient = ReturnType<typeof createGymApiClient>;
