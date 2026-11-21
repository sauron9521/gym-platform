import { describe, expect, it } from 'vitest';

import { loadTrainerRecentPrograms } from '../src/shared/api/trainer-recent-programs';

const origin = 'https://trainer-api.internal.test';
const cookie = '__Host-session=opaque';
const record = {
  id: 'program-1',
  trainerId: 'trainer-1',
  status: 'DRAFT',
  versions: [
    {
      id: 'version-1',
      version: 1,
      title: 'Full Body',
      description: null,
      durationWeeks: 3,
      status: 'DRAFT',
      publishedAt: null,
    },
  ],
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-21T00:00:00.000Z',
};
const response = {
  data: [record],
  meta: { total: 1, skip: 0, take: 5, totalPages: 1 },
};

describe('Trainer recent programs read boundary', () => {
  it('does not fetch without a session cookie', async () => {
    let count = 0;
    expect(
      await loadTrainerRecentPrograms('', origin, async () => {
        count += 1;
        return Response.json(response);
      }),
    ).toEqual({ kind: 'unauthenticated' });
    expect(count).toBe(0);
  });

  it('uses a typed bounded GET with trusted uncached cookie transport', async () => {
    let seen: Request | undefined;
    expect(
      await loadTrainerRecentPrograms(cookie, origin, async (input) => {
        seen = new Request(input);
        return Response.json(response);
      }),
    ).toEqual({
      kind: 'ready',
      total: 1,
      programs: [{ id: 'program-1', title: 'Full Body', status: 'DRAFT' }],
    });
    expect(seen).toBeDefined();
    const url = new URL(seen!.url);
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe('/training-programs');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '5' });
    expect(seen!.headers.get('cookie')).toBe(cookie);
    expect(seen!.headers.get('authorization')).toBeNull();
    expect(seen!.credentials).toBe('omit');
    expect(seen!.cache).toBe('no-store');
    expect(seen!.redirect).toBe('error');
    expect(seen!.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps a real empty result distinct from an outage', async () => {
    const data = { data: [], meta: { total: 0, skip: 0, take: 5, totalPages: 0 } };
    expect(
      await loadTrainerRecentPrograms(cookie, origin, async () => Response.json(data)),
    ).toEqual({ kind: 'ready', programs: [], total: 0 });
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'unavailable'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('fails closed for HTTP %i', async (status, kind) => {
    expect(
      await loadTrainerRecentPrograms(cookie, origin, async () => new Response(null, { status })),
    ).toEqual({ kind });
  });

  it('rejects malformed or unexpectedly unbounded program lists', async () => {
    const invalid = [
      { ...response, data: Array.from({ length: 6 }, () => record) },
      { ...response, data: [{ ...record, versions: [] }] },
      { ...response, data: [{ ...record, versions: [{ ...record.versions[0], title: '' }] }] },
      { ...response, data: [{ ...record, status: 'PRIVATE' }] },
      { ...response, data: [record, record] },
      { ...response, meta: { ...response.meta, take: 100 } },
      { ...response, meta: { ...response.meta, total: -1 } },
      { ...response, meta: { ...response.meta, totalPages: 10 } },
    ];
    for (const value of invalid) {
      expect(
        await loadTrainerRecentPrograms(cookie, origin, async () => Response.json(value)),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('does not send cookies to an invalid origin or expose upstream errors', async () => {
    let calls = 0;
    expect(
      await loadTrainerRecentPrograms(cookie, 'https://secret@other.test', async () => {
        calls += 1;
        return Response.json(response);
      }),
    ).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);

    for (const send of [
      async () => new Response(null, { status: 302, headers: { location: 'https://other.test' } }),
      async () => new Response('{bad json', { status: 200 }),
      async () => {
        throw new Error('Do not expose upstream session');
      },
    ]) {
      expect(await loadTrainerRecentPrograms(cookie, origin, send)).toEqual({
        kind: 'unavailable',
      });
    }
  });
});
