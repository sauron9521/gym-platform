import { describe, expect, it } from 'vitest';

import { loadTrainerClients, parseTrainerClientsPage } from '../src/shared/api/trainer-clients';

const apiOrigin = 'https://api.internal.test';
const cookie = '__Host-sid=opaque';

const record = {
  id: 'relation-1',
  trainerId: 'trainer-1',
  athleteId: 'athlete-1',
  status: 'ACTIVE',
  athlete: { id: 'athlete-1', email: 'athlete@example.test', role: 'ATHLETE' },
};

const pageResponse = {
  data: [record],
  meta: { total: 9, skip: 8, take: 8, totalPages: 2 },
};

describe('Trainer dashboard read boundary', () => {
  it.each([
    [undefined, 1],
    [['1', '2'], 1],
    ['0', 1],
    ['-1', 1],
    ['1e3', 1],
    ['1.1', 1],
    ['10001', 1],
    ['20', 20],
    ['10000', 10000],
  ])('parses bounded page input %j', (value, expected) => {
    expect(parseTrainerClientsPage(value)).toBe(expected);
  });

  it('never loads private data without a cookie or with unbounded pagination', async () => {
    let calls = 0;
    const send: typeof fetch = async () => {
      calls += 1;
      return Response.json(pageResponse);
    };
    expect(await loadTrainerClients('', 1, apiOrigin, send)).toEqual({
      kind: 'unauthenticated',
    });
    expect(await loadTrainerClients(cookie, 0, apiOrigin, send)).toEqual({
      kind: 'unavailable',
    });
    expect(await loadTrainerClients(cookie, 10001, apiOrigin, send)).toEqual({
      kind: 'unavailable',
    });
    expect(calls).toBe(0);
  });

  it('uses only a fixed server API origin and asks for scoped active rows with strict transport', async () => {
    let seen: Request | undefined;
    const send: typeof fetch = async (request) => {
      seen = new Request(request);
      return Response.json(pageResponse);
    };
    const result = await loadTrainerClients(cookie, 2, apiOrigin, send);
    expect(result).toEqual({
      kind: 'ready',
      clients: [{ id: 'relation-1', email: 'athlete@example.test' }],
      page: 2,
      total: 9,
      totalPages: 2,
    });
    expect(seen).toBeDefined();
    const url = new URL(seen!.url);
    expect(url.origin).toBe(apiOrigin);
    expect(url.pathname).toBe('/trainer-athletes');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      limit: '8',
      status: 'ACTIVE',
      scope: 'trainer',
    });
    expect(seen!.headers.get('cookie')).toBe(cookie);
    expect(seen!.headers.get('authorization')).toBeNull();
    expect(seen!.credentials).toBe('omit');
    expect(seen!.redirect).toBe('error');
    expect(seen!.cache).toBe('no-store');
    expect(seen!.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('fails closed on API HTTP %i', async (status, kind) => {
    const result = await loadTrainerClients(
      cookie,
      1,
      apiOrigin,
      async () => new Response(null, { status }),
    );
    expect(result).toEqual({ kind });
  });

  it('does not render incomplete, redacted or mismatched active data', async () => {
    const records = [
      { ...pageResponse, data: [{ ...record, status: 'PENDING' }] },
      { ...pageResponse, data: [{ ...record, athlete: { id: 'athlete-1' } }] },
      { ...pageResponse, meta: { ...pageResponse.meta, take: 100 } },
      { ...pageResponse, data: Array.from({ length: 9 }, () => record) },
      { ...pageResponse, meta: { ...pageResponse.meta, total: -1 } },
    ];
    for (const payload of records) {
      expect(
        await loadTrainerClients(cookie, 2, apiOrigin, async () => Response.json(payload)),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('fails closed on unsafe origin, redirect, malformed JSON or network outage', async () => {
    let calls = 0;
    const unsafe = await loadTrainerClients(
      cookie,
      1,
      'https://person:secret@api.test',
      async () => {
        calls += 1;
        return Response.json(pageResponse);
      },
    );
    expect(unsafe).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);

    for (const send of [
      async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      async () => new Response('{bad', { status: 200 }),
      async () => {
        throw new Error('sensitive internal API error');
      },
    ]) {
      expect(await loadTrainerClients(cookie, 2, apiOrigin, send)).toEqual({
        kind: 'unavailable',
      });
    }
  });

  it('represents an empty relationship list without making up client metrics', async () => {
    const result = await loadTrainerClients(cookie, 1, apiOrigin, async () =>
      Response.json({ data: [], meta: { total: 0, skip: 0, take: 8, totalPages: 0 } }),
    );
    expect(result).toEqual({ kind: 'ready', clients: [], page: 1, total: 0, totalPages: 0 });
  });
});
