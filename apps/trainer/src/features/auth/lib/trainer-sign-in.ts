export type TrainerSignInResult =
  | 'authenticated'
  | 'invalidCredentials'
  | 'rateLimited'
  | 'security'
  | 'notApproved'
  | 'mfaRequired'
  | 'unavailable';

type Grants = { athlete: boolean; trainer: boolean; admin: boolean };

function validGrants(value: unknown): value is Grants {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const grants = value as Record<string, unknown>;
  return (
    typeof grants.athlete === 'boolean' &&
    typeof grants.trainer === 'boolean' &&
    typeof grants.admin === 'boolean'
  );
}

async function clearSession(send: typeof fetch) {
  try {
    await send('/backend/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
  } catch {
    // Best effort only: server route and API authorization remain fail-closed.
  }
}

/**
 * Existing Nest identity, session cookie and CSRF origin validation remain
 * authoritative. Browser requests use only the fixed same-origin /backend
 * rewrite. Never handle tokens or read Set-Cookie in client JavaScript.
 */
export async function signInTrainer(
  email: string,
  password: string,
  send: typeof fetch = fetch,
): Promise<TrainerSignInResult> {
  let loginSucceeded = false;

  try {
    const login = await send('/backend/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (login.status === 401) return 'invalidCredentials';
    if (login.status === 403) return 'security';
    if (login.status === 429) return 'rateLimited';
    if (login.status !== 200) return 'unavailable';

    loginSucceeded = true;
    const response: unknown = await login.json();
    if (
      typeof response !== 'object' ||
      response === null ||
      !('mfaRequired' in response) ||
      typeof response.mfaRequired !== 'boolean'
    ) {
      await clearSession(send);
      return 'unavailable';
    }

    if (response.mfaRequired) {
      await clearSession(send);
      return 'mfaRequired';
    }

    const grantsResponse = await send('/backend/users/me/capabilities', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });

    if (grantsResponse.status !== 200) {
      await clearSession(send);
      return 'unavailable';
    }

    const grants: unknown = await grantsResponse.json();
    if (!validGrants(grants)) {
      await clearSession(send);
      return 'unavailable';
    }

    if (grants.admin || !grants.trainer) {
      await clearSession(send);
      return 'notApproved';
    }

    return 'authenticated';
  } catch {
    if (loginSucceeded) await clearSession(send);
    return 'unavailable';
  }
}
