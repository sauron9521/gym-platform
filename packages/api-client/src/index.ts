import createClient from 'openapi-fetch';

import type { paths } from './generated/schema.js';

export type { paths, components, operations } from './generated/schema.js';

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

type ClientOptions = NonNullable<Parameters<typeof createGymApiClient>[0]>;
type HttpFetch = (request: Request) => Promise<Response>;

export type AuthFailure = 'unauthenticated' | 'forbidden';
export type AuthFailureListener = (failure: AuthFailure) => void | Promise<void>;
export type TokenGetter = () => string | null | undefined | Promise<string | null | undefined>;

type AuthCallbacks = {
  onAuthFailure?: AuthFailureListener;
};

/** Distinguish an expired/missing session from an authorization denial. */
export function classifyAuthFailure(status: number): AuthFailure | null {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  return null;
}

function observeAuthFailures(
  send: HttpFetch,
  listener: AuthFailureListener | undefined,
): HttpFetch {
  return async (request) => {
    const response = await send(request);
    const failure = classifyAuthFailure(response.status);
    if (failure) await listener?.(failure);
    return response;
  };
}

/**
 * Browser session authentication.
 *
 * The browser handles HttpOnly cookies; this client does not read, persist, or
 * forward them explicitly. Next.js server-side requests need a separate,
 * deliberate cookie-forwarding policy and MUST NOT reuse this browser client.
 */
export function createBrowserSessionClient(
  options: Omit<ClientOptions, 'credentials'> & AuthCallbacks,
): GymApiClient {
  const { onAuthFailure, ...clientOptions } = options;
  const send = clientOptions.fetch ?? globalThis.fetch;

  return createGymApiClient({
    ...clientOptions,
    credentials: 'include',
    fetch: observeAuthFailures(send, onAuthFailure),
  });
}

/**
 * Short-lived bearer access tokens for native clients.
 *
 * The caller owns token storage and renewal. This client never persists or
 * refreshes tokens and explicitly avoids cookies and followed redirects.
 */
export function createBearerTokenClient(
  options: Omit<ClientOptions, 'credentials'> &
    AuthCallbacks & {
      getAccessToken: TokenGetter;
    },
): GymApiClient {
  const { getAccessToken, onAuthFailure, ...clientOptions } = options;

  if (!clientOptions.baseUrl) {
    throw new Error('Bearer API requires an explicit absolute baseUrl');
  }

  const base = new URL(clientOptions.baseUrl);
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Bearer API requires an HTTP(S) baseUrl');
  }

  const send = clientOptions.fetch ?? globalThis.fetch;

  const withBearer: HttpFetch = async (input) => {
    const request = new Request(input);

    // Never send a caller-supplied access token to an unrelated origin.
    if (new URL(request.url).origin !== base.origin) {
      throw new Error('Refusing to send bearer authentication to a different origin');
    }

    const token = await getAccessToken();
    const headers = new Headers(request.headers);
    headers.delete('authorization');
    if (token) headers.set('authorization', `Bearer ${token}`);

    return send(
      new Request(request, {
        headers,
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  };

  return createGymApiClient({
    ...clientOptions,
    credentials: 'omit',
    fetch: observeAuthFailures(withBearer, onAuthFailure),
  });
}
