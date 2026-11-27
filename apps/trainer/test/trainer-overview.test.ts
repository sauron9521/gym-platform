import { describe, expect, it } from 'vitest';

import { loadTrainerOverview } from '../src/shared/api/trainer-overview';

const apiOrigin = 'https://api.internal.test';
const cookie = '__Host-sid=opaque';

const payload = {
  asOf: '2026-11-21T12:00:00.000Z',
  windowStart: '2026-10-22T12:00:00.000Z',
  activeClients: 2,
  activeProgramAssignments: 4,
  completedProgramWorkouts30d: 7,
};

describe('Trainer dashboard KPI read boundary', () => {
  it('never fetches aggregates without a session cookie', async () => {
    let calls = 0;
    expect(
      await loadTrainerOverview('', apiOrigin, async () => {
        calls += 1;
        return Response.json(payload);
      }),
    ).toEqual({ kind: 'unauthenticated' });
    expect(calls).toBe(0);
  });

  it('uses trusted uncached cookie-only transport and typed aggregate endpoint', async () => {
    let seen: Request | undefined;
    const result = await loadTrainerOverview(cookie, apiOrigin, async (input) => {
      seen = new Request(input);
      return Response.json(payload);
    });
    expect(result).toEqual({ kind: 'ready', ...payload });
    expect(seen).toBeDefined();
    expect(new URL(seen!.url)).toMatchObject({
      origin: apiOrigin,
      pathname: '/trainer-dashboard/overview',
    });
    expect(seen!.headers.get('cookie')).toBe(cookie);
    expect(seen!.headers.get('authorization')).toBeNull();
    expect(seen!.credentials).toBe('omit');
    expect(seen!.redirect).toBe('error');
    expect(seen!.cache).toBe('no-store');
    expect(seen!.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves true zero metrics rather than displaying an unavailable state', async () => {
    const zeros = {
      ...payload,
      activeClients: 0,
      activeProgramAssignments: 0,
      completedProgramWorkouts30d: 0,
    };
    expect(await loadTrainerOverview(cookie, apiOrigin, async () => Response.json(zeros))).toEqual({
      kind: 'ready',
      ...zeros,
    });
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('fails closed on HTTP %i', async (status, kind) => {
    expect(
      await loadTrainerOverview(cookie, apiOrigin, async () => new Response(null, { status })),
    ).toEqual({ kind });
  });

  it('never treats malformed or impossible aggregate counts as verified KPI values', async () => {
    const invalid = [
      { ...payload, activeClients: -1 },
      { ...payload, activeProgramAssignments: 1.5 },
      { ...payload, completedProgramWorkouts30d: Number.MAX_SAFE_INTEGER + 1 },
      { ...payload, activeClients: '2' },
      { ...payload, asOf: 'not-a-date' },
      { ...payload, windowStart: payload.asOf },
      { ...payload, asOf: '2026-11-21T12:00:00', windowStart: '2026-10-22T12:00:00' },
      { ...payload, asOf: '2026-02-30T12:00:00Z', windowStart: '2026-01-31T12:00:00Z' },
      { ...payload, windowStart: '2026-10-23T12:00:00.000Z' },
      { ...payload, windowStart: '2026-12-01T12:00:00.000Z' },
      { ...payload, activeProgramAssignments: undefined },
      { activeClients: 2 },
    ];
    for (const response of invalid) {
      expect(
        await loadTrainerOverview(cookie, apiOrigin, async () => Response.json(response)),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('rejects unsafe origins before sending the cookie', async () => {
    let calls = 0;
    expect(
      await loadTrainerOverview(cookie, 'https://user:secret@api.internal.test', async () => {
        calls += 1;
        return Response.json(payload);
      }),
    ).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);
  });

  it('hides redirects, malformed JSON and network errors', async () => {
    for (const send of [
      async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      async () => new Response('{invalid', { status: 200 }),
      async () => {
        throw new Error('Do not expose private headers');
      },
    ]) {
      expect(await loadTrainerOverview(cookie, apiOrigin, send)).toEqual({
        kind: 'unavailable',
      });
    }
  });
});
