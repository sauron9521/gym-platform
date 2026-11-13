import { createGymApiClient } from '@gym/api-client';

/**
 * Pass a URL reachable from the phone or emulator.
 * An access-token middleware will be added with the mobile auth flow.
 */
export function createMobileApi(baseUrl: string) {
  return createGymApiClient({ baseUrl });
}
