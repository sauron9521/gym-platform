import { createGymApiClient } from '@gym/api-client';

import { getTrainerApiOrigin } from './upstream.mjs';

/** Trusted, uncached server-side API transport for Trainer read models. */
export function createTrainerServerApiClient(
  cookieHeader: string,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
) {
  const origin = getTrainerApiOrigin(configuredOrigin);
  return createGymApiClient({
    baseUrl: origin,
    credentials: 'omit',
    headers: { cookie: cookieHeader, accept: 'application/json' },
    fetch: async (input) => {
      const request = new Request(input);
      // Never forward the host-only cookie to a different HTTP origin.
      if (new URL(request.url).origin !== origin) {
        throw new Error('Untrusted Trainer API destination');
      }
      return send(
        new Request(request, {
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        }),
      );
    },
  });
}
