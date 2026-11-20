import { getTrainerApiOrigin } from './upstream.mjs';

export type TrainerAccess =
  | { kind: 'allowed' }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

type AccountCapabilities = {
  athlete: boolean;
  trainer: boolean;
  admin: boolean;
};

function isCapabilities(value: unknown): value is AccountCapabilities {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const grants = value as Record<string, unknown>;
  return (
    typeof grants.athlete === 'boolean' &&
    typeof grants.trainer === 'boolean' &&
    typeof grants.admin === 'boolean'
  );
}

/**
 * Trainer Web can render protected content only with a current, persisted
 * trainer grant. The API remains authoritative for data access and mutations.
 * Never derive the upstream from Host, Origin, query parameters or cookies.
 */
export async function verifyTrainerAccess(
  cookieHeader: string,
  configuredOrigin: string | undefined = process.env.GYM_API_INTERNAL_URL,
  send: typeof fetch = fetch,
): Promise<TrainerAccess> {
  if (!cookieHeader) return { kind: 'unauthenticated' };

  try {
    const upstream = getTrainerApiOrigin(configuredOrigin);
    const response = await send(upstream + '/users/me/capabilities', {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status !== 200) return { kind: 'unavailable' };

    const capabilities: unknown = await response.json();
    if (!isCapabilities(capabilities)) return { kind: 'unavailable' };
    if (capabilities.admin || !capabilities.trainer) return { kind: 'forbidden' };

    return { kind: 'allowed' };
  } catch {
    // Fail closed for untrusted responses, redirects, timeouts or API outages.
    // Never expose the cookie value or upstream errors in the client response.
    return { kind: 'unavailable' };
  }
}
