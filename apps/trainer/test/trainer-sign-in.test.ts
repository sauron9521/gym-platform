import { describe, expect, it } from 'vitest';

import { signInTrainer } from '../src/features/auth/lib/trainer-sign-in';

describe('Trainer browser sign-in safety', () => {
  it('authenticates only after the same-origin cookie session has a current trainer grant', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const result = await signInTrainer('trainer@example.test', 'very-secret', async (input, init) => {
      requests.push({ input: String(input), init });
      return requests.length === 1
        ? Response.json({ mfaRequired: false })
        : Response.json({ athlete: true, trainer: true, admin: false });
    });

    expect(result).toBe('authenticated');
    expect(requests.map((request) => request.input)).toEqual([
      '/backend/auth/login',
      '/backend/users/me/capabilities',
    ]);
    for (const { init } of requests) {
      expect(init).toMatchObject({
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      expect(init?.headers).not.toHaveProperty('authorization');
      expect(init?.headers).not.toHaveProperty('cookie');
    }
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({ email: 'trainer@example.test', password: 'very-secret' }),
    );
    expect(requests[1]?.init?.body).toBeUndefined();
  });

  it.each([
    [401, 'invalidCredentials'],
    [403, 'security'],
    [429, 'rateLimited'],
    [500, 'unavailable'],
  ] as const)('does not query grants or sign out when login returns %i', async (status, result) => {
    let requests = 0;
    const outcome = await signInTrainer('a@example.test', 'secret', async () => {
      requests += 1;
      return new Response(null, { status });
    });
    expect(outcome).toBe(result);
    expect(requests).toBe(1);
  });

  it.each([
    [{ athlete: true, trainer: false, admin: false }, 'notApproved'],
    [{ athlete: true, trainer: true, admin: true }, 'notApproved'],
    [{ athlete: false, trainer: false, admin: true }, 'notApproved'],
    [{ athlete: true, trainer: 'yes', admin: false }, 'unavailable'],
    [{ athlete: true, trainer: true }, 'unavailable'],
  ] as const)('clears an issued session when capabilities are insufficient', async (grants, expected) => {
    const paths: string[] = [];
    const result = await signInTrainer('a@example.test', 'secret', async (input) => {
      paths.push(String(input));
      if (paths.length === 1) return Response.json({ mfaRequired: false });
      if (paths.length === 2) return Response.json(grants);
      return new Response(null, { status: 204 });
    });
    expect(result).toBe(expected);
    expect(paths).toEqual([
      '/backend/auth/login',
      '/backend/users/me/capabilities',
      '/backend/auth/sign-out',
    ]);
  });

  it('clears a pending MFA challenge without granting a trainer workspace', async () => {
    const requests: string[] = [];
    const result = await signInTrainer('a@example.test', 'secret', async (input) => {
      requests.push(String(input));
      return requests.length === 1
        ? Response.json({ mfaRequired: true })
        : new Response(null, { status: 204 });
    });
    expect(result).toBe('mfaRequired');
    expect(requests).toEqual(['/backend/auth/login', '/backend/auth/sign-out']);
  });

  it('fails closed on malformed sign-in, API outage, invalid JSON or missing session', async () => {
    const invalid = await signInTrainer('a@example.test', 'secret', async (_input, _init) =>
      Response.json({ accessToken: 'not-an-accepted-browser-response' }),
    );
    expect(invalid).toBe('unavailable');

    const offline = await signInTrainer('a@example.test', 'secret', async () => {
      throw new Error('the network is unavailable');
    });
    expect(offline).toBe('unavailable');

    const paths: string[] = [];
    const missingSession = await signInTrainer('a@example.test', 'secret', async (input) => {
      paths.push(String(input));
      if (paths.length === 1) return Response.json({ mfaRequired: false });
      return new Response(null, { status: paths.length === 2 ? 401 : 204 });
    });
    expect(missingSession).toBe('unavailable');
    expect(paths).toHaveLength(3);
  });
});
