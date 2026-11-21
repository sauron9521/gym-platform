export type TrainerSignOutResult = 'signedOut' | 'unavailable';

/**
 * Revoke only this browser's existing Nest session via Trainer's same-origin
 * proxy. Session storage, invalidation and Set-Cookie remain the API's job.
 * An expired/revoked session (401) is already inaccessible to the workspace.
 */
export async function signOutTrainer(send: typeof fetch = fetch): Promise<TrainerSignOutResult> {
  try {
    const response = await send('/backend/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });

    if (response.status === 204 || response.status === 401) return 'signedOut';
    return 'unavailable';
  } catch {
    // Do not claim sign-out on transport errors, CSRF rejection or timeouts.
    return 'unavailable';
  }
}
