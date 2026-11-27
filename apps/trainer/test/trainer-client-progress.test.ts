import { describe, expect, it } from 'vitest';

import { loadTrainerClientProgress } from '../src/shared/api/trainer-client-progress';

const origin = 'https://trainer-api.internal.test';
const cookie = '__Host-sid=opaque';
const id = 'a1b2c3d4-e5f6-4738-9abc-1234567890ab';
const foreignId = 'abcdef12-3456-4789-abcd-0123456789ab';
const progress = {
  asOf: '2026-11-21T12:00:00.000Z',
  windowStart: '2026-10-22T12:00:00.000Z',
  activeProgramAssignments: 2,
  completedProgramWorkouts30d: 3,
};
const relation = {
  id,
  status: 'ACTIVE',
  trainerId: 'trainer-1',
  athleteId: 'athlete-1',
  athlete: { id: 'athlete-1', email: 'owned@example.test', role: 'ATHLETE' },
};

function sendBoth(data: unknown = progress, info: unknown = relation) {
  const calls: Request[] = [];
  const send: typeof fetch = async (input) => {
    const request = new Request(input);
    calls.push(request);
    return Response.json(request.url.includes('/progress') ? data : info);
  };
  return { calls, send };
}

describe('Trainer individual client progress boundary', () => {
  it('never fetches without a cookie or for an invalid relationship UUID', async () => {
    let calls = 0;
    const send: typeof fetch = async () => {
      calls++;
      return Response.json(progress);
    };
    expect(await loadTrainerClientProgress('', id, origin, send)).toEqual({
      kind: 'unauthenticated',
    });
    for (const unsafe of ['', 'not-a-uuid', '../admin', foreignId + '/../../', '0'.repeat(300)]) {
      expect(await loadTrainerClientProgress(cookie, unsafe, origin, send)).toEqual({
        kind: 'not_found',
      });
    }
    expect(calls).toBe(0);
  });

  it('uses scoped typed reads, then fetches the matching ACTIVE relationship', async () => {
    const { calls, send } = sendBoth();
    expect(await loadTrainerClientProgress(cookie, id, origin, send)).toEqual({
      kind: 'ready',
      clientEmail: 'owned@example.test',
      ...progress,
    });
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!.url).pathname).toBe('/trainer-dashboard/clients/' + id + '/progress');
    expect(new URL(calls[1]!.url).pathname).toBe('/trainer-athletes/' + id);
    for (const r of calls) {
      expect(new URL(r.url).origin).toBe(origin);
      expect(r.headers.get('cookie')).toBe(cookie);
      expect(r.headers.get('authorization')).toBeNull();
      expect(r.credentials).toBe('omit');
      expect(r.cache).toBe('no-store');
      expect(r.redirect).toBe('error');
      expect(r.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('renders actual zero metrics distinctly from unavailable', async () => {
    const zeros = { ...progress, activeProgramAssignments: 0, completedProgramWorkouts30d: 0 };
    expect(await loadTrainerClientProgress(cookie, id, origin, sendBoth(zeros).send)).toEqual({
      kind: 'ready',
      clientEmail: 'owned@example.test',
      ...zeros,
    });
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('stops before contact lookup when progress is HTTP %i', async (status, kind) => {
    let calls = 0;
    expect(
      await loadTrainerClientProgress(cookie, id, origin, async () => {
        calls++;
        return new Response(null, { status });
      }),
    ).toEqual({ kind });
    expect(calls).toBe(1);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'unavailable'],
  ] as const)('hides progress if client lookup is HTTP %i', async (status, kind) => {
    let calls = 0;
    expect(
      await loadTrainerClientProgress(cookie, id, origin, async () => {
        calls++;
        return calls === 1 ? Response.json(progress) : new Response(null, { status });
      }),
    ).toEqual({ kind });
    expect(calls).toBe(2);
  });

  it('hides stale, mismatched and historically redacted relationship metadata', async () => {
    const bad = [
      { ...relation, status: 'TERMINATED' },
      { ...relation, status: 'PENDING' },
      { ...relation, id: foreignId },
      { ...relation, athlete: { id: 'athlete-1' } },
      { ...relation, athlete: { id: 'athlete-1', email: 'invalid-email' } },
    ];
    for (const item of bad) {
      expect(
        await loadTrainerClientProgress(cookie, id, origin, sendBoth(progress, item).send),
      ).toEqual({
        kind: 'not_found',
      });
    }
  });

  it('rejects implausible counts or dates before requesting identity data', async () => {
    const bad = [
      { ...progress, activeProgramAssignments: -1 },
      { ...progress, activeProgramAssignments: '2' },
      { ...progress, completedProgramWorkouts30d: 2.5 },
      { ...progress, completedProgramWorkouts30d: Number.MAX_SAFE_INTEGER + 1 },
      { ...progress, windowStart: progress.asOf },
      { ...progress, asOf: '2026-11-21T12:00:00', windowStart: '2026-10-22T12:00:00' },
      { ...progress, asOf: '2026-02-30T12:00:00Z', windowStart: '2026-01-31T12:00:00Z' },
      { ...progress, windowStart: '2026-10-23T12:00:00.000Z' },
      { ...progress, asOf: 'invalid' },
      { asOf: progress.asOf },
    ];
    for (const item of bad) {
      const { calls, send } = sendBoth(item);
      expect(await loadTrainerClientProgress(cookie, id, origin, send)).toEqual({
        kind: 'unavailable',
      });
      expect(calls).toHaveLength(1);
    }
  });

  it('rejects an untrusted origin without sending a session cookie', async () => {
    let calls = 0;
    expect(
      await loadTrainerClientProgress(cookie, id, 'https://user:password@evil.test', async () => {
        calls++;
        return Response.json(progress);
      }),
    ).toEqual({ kind: 'unavailable' });
    expect(calls).toBe(0);
  });

  it('never exposes partial contact data on redirect, JSON parse or transport failures', async () => {
    for (const send of [
      async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      async () => new Response('{invalid', { status: 200 }),
      async () => {
        throw new Error('private request failed');
      },
    ]) {
      expect(await loadTrainerClientProgress(cookie, id, origin, send)).toEqual({
        kind: 'unavailable',
      });
    }
  });
});
