import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { verifyTrainerAccess } from '../src/shared/api/server-capability';

const apiOrigin = 'https://api.internal.test';
const cookie = '__Host-gym-session=opaque';

describe('Trainer server capability boundary', () => {
  it('does not contact the API without an incoming Cookie header', async () => {
    let calls = 0;
    const access = await verifyTrainerAccess('', apiOrigin, async () => {
      calls += 1;
      throw new Error('should not run');
    });
    expect(access).toEqual({ kind: 'unauthenticated' });
    expect(calls).toBe(0);
  });

  it('uses only the fixed server origin, forwards only Cookie, and never caches grants', async () => {
    const calls: Array<{ url: string; options?: RequestInit }> = [];
    const access = await verifyTrainerAccess(cookie, apiOrigin, async (input, options) => {
      calls.push({ url: String(input), options });
      return Response.json({ athlete: true, trainer: true, admin: false });
    });

    expect(access).toEqual({ kind: 'allowed' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(apiOrigin + '/users/me/capabilities');
    expect(calls[0]?.options).toMatchObject({
      headers: { cookie, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
    });
    expect(calls[0]?.options?.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys((calls[0]?.options?.headers ?? {}) as object)).toEqual(['cookie', 'accept']);
  });

  it('permits an approved ATHLETE-role trainer without checking a stale session role', async () => {
    const access = await verifyTrainerAccess(cookie, apiOrigin, async () =>
      Response.json({ athlete: true, trainer: true, admin: false }),
    );
    expect(access).toEqual({ kind: 'allowed' });
  });

  it.each([
    [{ athlete: true, trainer: false, admin: false }, 'forbidden'],
    [{ athlete: true, trainer: true, admin: true }, 'forbidden'],
    [{ athlete: false, trainer: false, admin: true }, 'forbidden'],
    [{ athlete: true, trainer: 'true', admin: false }, 'unavailable'],
    [{ athlete: true, trainer: true }, 'unavailable'],
    [[], 'unavailable'],
    [null, 'unavailable'],
  ] as const)('does not grant access for invalid or revoked grants', async (grants, kind) => {
    const access = await verifyTrainerAccess(cookie, apiOrigin, async () => Response.json(grants));
    expect(access).toEqual({ kind });
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ] as const)('fails closed for upstream HTTP %i', async (status, kind) => {
    const access = await verifyTrainerAccess(
      cookie,
      apiOrigin,
      async () => new Response(null, { status }),
    );
    expect(access).toEqual({ kind });
  });

  it('fails closed for a network error, invalid JSON and unsafe upstream configuration', async () => {
    const offline = await verifyTrainerAccess(cookie, apiOrigin, async () => {
      throw new Error('network down: sensitive internal detail');
    });
    expect(offline).toEqual({ kind: 'unavailable' });

    const invalidJson = await verifyTrainerAccess(
      cookie,
      apiOrigin,
      async () => new Response('not-json', { status: 200 }),
    );
    expect(invalidJson).toEqual({ kind: 'unavailable' });

    let calls = 0;
    const unsafe = await verifyTrainerAccess(cookie, 'https://user:pass@api.test', async () => {
      calls += 1;
      return Response.json({ athlete: true, trainer: true, admin: false });
    });
    expect(unsafe).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);
  });

  it('keeps the workspace an uncached server route guarded before content is rendered', async () => {
    const page = await readFile(new URL('../src/app/workspace/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("export const dynamic = 'force-dynamic'");
    expect(page).toContain("const cookieHeader = (await headers()).get('cookie') ?? ''");
    expect(page).toContain('await verifyTrainerAccess(cookieHeader)');
    expect(page).toContain("if (access.kind !== 'allowed')");
    expect(page).not.toContain("'use client'");
  });
});
