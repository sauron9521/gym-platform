import { createGymApiClient } from '@gym/api-client';

/**
 * Browser requests send HttpOnly session cookies only when opted in.
 * NEXT_PUBLIC_API_URL is a public origin, not a secret.
 */
export const webApi = createGymApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  credentials: 'include',
});
