import { describe, expect, it } from 'vitest';

import {
  loadTrainerClientAssignments,
  parseClientAssignmentsPage,
} from '../src/shared/api/trainer-client-assignments';

const origin = 'https://trainer-api.internal.test';
const cookie = '__Host-sid=opaque';
const id = '123e4567-e89b-42d3-a456-426614174000';
const foreign = '87654321-e89b-42d3-a456-426614174000';
const trainerId = 'trainer-owned';
const record = (n: number, status = 'ACTIVE') => ({
  id: `assignment-${n}`,
  trainerAthleteId: id,
  status,
  version: {
    title: `Plan ${n}`,
    version: n,
    program: { trainerId },
  },
  trainerAthlete: { id, trainerId, status: 'ACTIVE' },
});
const result = (data: unknown[] = [record(1)], total = data.length, page = 1) => ({
  data,
  meta: { total, skip: (page - 1) * 8, take: 8, totalPages: Math.ceil(total / 8) },
});

function server(payload: unknown, status = 200) {
  const calls: Request[] = [];
  const send: typeof fetch = async (input) => {
    calls.push(new Request(input));
    return Response.json(payload, { status });
  };
  return { calls, send };
}

describe('Trainer assigned programs page bounds', () => {
  it.each([
    [undefined, 1],
    ['1', 1],
    ['2', 2],
    ['10000', 10000],
    ['0', 1],
    ['10001', 1],
    ['-1', 1],
    ['1.5', 1],
    ['0001', 1],
    [['2'], 1],
    ['1&trainerAthleteId=other', 1],
  ] as const)('sanitizes a page parameter %s', (value, page) => {
    expect(parseClientAssignmentsPage(value)).toBe(page);
  });

  it('does not send any request for missing cookie, bad relation or invalid page', async () => {
    const { calls, send } = server(result());
    expect(await loadTrainerClientAssignments('', id, 1, origin, send)).toEqual({
      kind: 'unauthenticated',
    });
    expect(await loadTrainerClientAssignments(cookie, 'bad/id', 1, origin, send)).toEqual({
      kind: 'not_found',
    });
    for (const page of [0, -1, Number.NaN, 1.5, 10001]) {
      expect(await loadTrainerClientAssignments(cookie, id, page, origin, send)).toEqual({
        kind: 'unavailable',
      });
    }
    expect(calls).toHaveLength(0);
  });

  it('uses exactly one typed, bounded, SQL-scoped summary request with trusted cookie', async () => {
    const { calls, send } = server(result([record(1), record(2, 'COMPLETED')], 2));
    expect(await loadTrainerClientAssignments(cookie, id, 1, origin, send)).toEqual({
      kind: 'ready',
      assignments: [
        { id: 'assignment-1', title: 'Plan 1', version: 1, status: 'ACTIVE' },
        { id: 'assignment-2', title: 'Plan 2', version: 2, status: 'COMPLETED' },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    });
    expect(calls).toHaveLength(1);
    const request = calls[0]!;
    const url = new URL(request.url);
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe('/training-programs/assignments');
    expect(url.searchParams.get('trainerAthleteId')).toBe(id);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(url.searchParams.get('view')).toBe('summary');
    expect(url.searchParams.has('athleteId')).toBe(false);
    expect(request.headers.get('cookie')).toBe(cookie);
    expect(request.headers.get('authorization')).toBeNull();
    expect(request.cache).toBe('no-store');
    expect(request.credentials).toBe('omit');
    expect(request.redirect).toBe('error');
  });

  it('accepts real empty and legitimate out-of-range pages without fabricating records', async () => {
    expect(
      await loadTrainerClientAssignments(cookie, id, 1, origin, server(result([])).send),
    ).toEqual({
      kind: 'ready',
      assignments: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
    expect(
      await loadTrainerClientAssignments(cookie, id, 3, origin, server(result([], 9, 3)).send),
    ).toEqual({
      kind: 'ready',
      assignments: [],
      total: 9,
      page: 3,
      totalPages: 2,
    });
  });

  it('supports page two of a nine-item list using bounded data only', async () => {
    const { calls, send } = server(result([record(9, 'TERMINATED')], 9, 2));
    expect(await loadTrainerClientAssignments(cookie, id, 2, origin, send)).toEqual({
      kind: 'ready',
      assignments: [{ id: 'assignment-9', title: 'Plan 9', version: 9, status: 'TERMINATED' }],
      total: 9,
      page: 2,
      totalPages: 2,
    });
    expect(new URL(calls[0]!.url).searchParams.get('page')).toBe('2');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('fails closed on HTTP %i', async (status, kind) => {
    const { send } = server({ message: 'private' }, status);
    expect(await loadTrainerClientAssignments(cookie, id, 1, origin, send)).toEqual({ kind });
  });

  it('rejects duplicated, cross-client, ended or redacted assignment rows', async () => {
    const invalid = [
      [record(1), record(1)],
      [{ ...record(1), trainerAthleteId: foreign }],
      [{ ...record(1), trainerAthlete: { ...record(1).trainerAthlete, id: foreign } }],
      [{ ...record(1), trainerAthlete: { ...record(1).trainerAthlete, status: 'TERMINATED' } }],
      [{ ...record(1), version: { title: 'Hidden', version: 1 } }],
      [{ ...record(1), version: { ...record(1).version, program: { trainerId: 'foreign' } } }],
      [{ ...record(1), status: 'UNKNOWN' }],
      [{ ...record(1), version: { ...record(1).version, title: '' } }],
      [{ ...record(1), version: { ...record(1).version, version: 0 } }],
    ];
    for (const data of invalid) {
      expect(
        await loadTrainerClientAssignments(cookie, id, 1, origin, server(result(data)).send),
      ).toEqual({
        kind: 'unavailable',
      });
    }
  });

  it('rejects nonmatching, oversized, unsafe or incoherent pagination metadata', async () => {
    const invalid = [
      { ...result(), meta: { ...result().meta, total: -1 } },
      { ...result(), meta: { ...result().meta, skip: 8 } },
      { ...result(), meta: { ...result().meta, take: 100 } },
      { ...result(), meta: { ...result().meta, totalPages: 8 } },
      result(
        Array.from({ length: 9 }, (_, i) => record(i + 1)),
        9,
      ),
      result([record(1), record(2)], 1),
    ];
    for (const data of invalid) {
      expect(await loadTrainerClientAssignments(cookie, id, 1, origin, server(data).send)).toEqual({
        kind: 'unavailable',
      });
    }
  });

  it('never forwards a session cookie to an unsafe origin', async () => {
    let sent = 0;
    const send: typeof fetch = async () => {
      sent++;
      return Response.json(result());
    };
    expect(
      await loadTrainerClientAssignments(cookie, id, 1, 'https://user:secret@other.test', send),
    ).toEqual({
      kind: 'unavailable',
    });
    expect(sent).toBe(0);
  });

  it('fails safely on redirects, broken JSON and network errors', async () => {
    for (const send of [
      async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }),
      async () => new Response('{invalid json', { status: 200 }),
      async () => {
        throw new Error('private upstream outage');
      },
    ]) {
      expect(await loadTrainerClientAssignments(cookie, id, 1, origin, send)).toEqual({
        kind: 'unavailable',
      });
    }
  });
});
