import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { signOutTrainer } from '../src/features/auth/lib/trainer-sign-out';

describe('Trainer session termination', () => {
  it('revokes a browser session exclusively through the same-origin Nest endpoint', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const result = await signOutTrainer(async (input, init) => {
      requests.push({ path: String(input), init });
      return new Response(null, { status: 204 });
    });

    expect(result).toBe('signedOut');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.path).toBe('/backend/auth/sign-out');
    expect(requests[0]?.init).toEqual({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    expect(requests[0]?.init?.body).toBeUndefined();
  });

  it('treats an expired or previously revoked session as signed out', async () => {
    const result = await signOutTrainer(async () => new Response(null, { status: 401 }));
    expect(result).toBe('signedOut');
  });

  it.each([200, 201, 302, 400, 403, 404, 409, 429, 500, 503])(
    'does not claim that the session ended on HTTP %i',
    async (status) => {
      const result = await signOutTrainer(async () => new Response(null, { status }));
      expect(result).toBe('unavailable');
    },
  );

  it('does not claim logout on network, CSRF or redirect failures', async () => {
    const result = await signOutTrainer(async () => {
      throw new Error('secret internal backend state');
    });
    expect(result).toBe('unavailable');
  });

  it('keeps logout control behind the dynamic server capability guard', async () => {
    const page = await readFile(new URL('../src/app/workspace/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("export const dynamic = 'force-dynamic'");
    expect(page).toContain("if (access.kind !== 'allowed')");
    expect(page.indexOf("if (access.kind !== 'allowed')")).toBeLessThan(
      page.indexOf('<TrainerSignOutButton />'),
    );
  });
});
