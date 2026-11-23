import { describe, expect, it } from 'vitest';

import {
  loadTrainerProgramSelector,
  parseProgramChoicePage,
  parseVersionCursor,
} from '../src/shared/api/trainer-program-selector';

const origin = 'https://trainer-api.internal.test';
const cookie = '__Host-sid=opaque';
const programId = '123e4567-e89b-42d3-a456-426614174000';
const versionId = '123e4567-e89b-42d3-a456-426614174001';
const draftId = '123e4567-e89b-42d3-a456-426614174002';
const foreignId = '87654321-e89b-42d3-a456-426614174000';
const trainerId = '123e4567-e89b-42d3-a456-426614174003';

const record = (id = programId, title = 'My program', status = 'PUBLISHED') => ({
  id,
  trainerId,
  status,
  versions: [
    {
      id: versionId,
      title,
      version: 1,
      status: 'PUBLISHED',
      publishedAt: '2026-11-20T12:00:00.000Z',
    },
  ],
});

const version = (overrides: Record<string, unknown> = {}) => ({
  id: versionId,
  programId,
  title: 'Published plan v1',
  version: 1,
  status: 'PUBLISHED',
  publishedAt: '2026-11-20T12:00:00.000Z',
  ...overrides,
});

function list(data: unknown[] = [record()], total = data.length, page = 1) {
  return {
    data,
    meta: { total, skip: (page - 1) * 8, take: 8, totalPages: Math.ceil(total / 8) },
  };
}

function publishedPage(data: unknown[] = [version()], nextBeforeVersion: number | null = null) {
  return { data, nextBeforeVersion };
}

function backend(programs: unknown = list(), versions: unknown = publishedPage()) {
  const calls: Request[] = [];
  const send: typeof fetch = async (input) => {
    const request = new Request(input);
    calls.push(request);
    return Response.json(request.url.includes('/published-versions') ? versions : programs);
  };
  return { calls, send };
}

describe('Trainer published program/version read-only chooser', () => {
  it.each([
    [undefined, 1],
    ['1', 1],
    ['2', 2],
    ['10000', 10000],
    ['0', 1],
    ['10001', 1],
    ['-1', 1],
    ['01', 1],
    ['1.2', 1],
    [['2'], 1],
    ['2&programId=other', 1],
  ] as const)('normalizes invalid page query %s', (input, expected) => {
    expect(parseProgramChoicePage(input)).toBe(expected);
  });

  it.each([
    ['2', 2],
    ['2147483647', 2_147_483_647],
    ['2147483648', undefined],
    ['0', undefined],
    ['01', undefined],
    ['1.2', undefined],
    [['2', '3'], undefined],
    [undefined, undefined],
  ] as const)('parses the exclusive version cursor %s', (input, expected) => {
    expect(parseVersionCursor(input)).toBe(expected);
  });

  it('never sends an API request for missing credentials or unsafe pagination', async () => {
    const { calls, send } = backend();
    expect(await loadTrainerProgramSelector('', { page: 1 }, origin, send)).toEqual({
      kind: 'unauthenticated',
    });
    for (const page of [0, -1, 1.5, Number.NaN, 10001]) {
      expect(await loadTrainerProgramSelector(cookie, { page }, origin, send)).toEqual({
        kind: 'unavailable',
      });
    }
    expect(calls).toHaveLength(0);
  });

  it('makes exactly one trusted owner-scoped, PUBLISHED-only bounded read initially', async () => {
    const { calls, send } = backend();
    expect(await loadTrainerProgramSelector(cookie, { page: 1 }, origin, send)).toEqual({
      kind: 'ready',
      programs: [{ id: programId, title: 'My program' }],
      total: 1,
      page: 1,
      totalPages: 1,
      selection: { kind: 'none' },
    });
    expect(calls).toHaveLength(1);
    const r = calls[0]!;
    const url = new URL(r.url);
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe('/training-programs');
    expect(url.searchParams.get('status')).toBe('PUBLISHED');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.has('trainerId')).toBe(false);
    expect(r.method).toBe('GET');
    expect(r.headers.get('cookie')).toBe(cookie);
    expect(r.headers.get('authorization')).toBeNull();
    expect(r.redirect).toBe('error');
    expect(r.cache).toBe('no-store');
    expect(r.credentials).toBe('omit');
    expect(r.signal).toBeInstanceOf(AbortSignal);
  });

  it('selects a published row and ignores a draft ID supplied in the URL', async () => {
    const { calls, send } = backend();
    const selected = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId, versionId },
      origin,
      send,
    );
    expect(selected).toEqual({
      kind: 'ready',
      programs: [{ id: programId, title: 'My program' }],
      total: 1,
      page: 1,
      totalPages: 1,
      selection: {
        kind: 'ready',
        program: { id: programId, title: 'My program' },
        versions: [{ id: versionId, title: 'Published plan v1', version: 1 }],
        nextBeforeVersion: null,
        selectedVersion: { id: versionId, title: 'Published plan v1', version: 1 },
      },
    });
    expect(calls.map((r) => new URL(r.url).pathname)).toEqual([
      '/training-programs',
      `/training-programs/${programId}/published-versions`,
    ]);
    const versionQuery = new URL(calls[1]!.url).searchParams;
    expect(versionQuery.get('limit')).toBe('40');
    expect(versionQuery.has('beforeVersion')).toBe(false);
    for (const r of calls) {
      expect(r.method).toBe('GET');
      expect(r.headers.get('cookie')).toBe(cookie);
      expect(r.cache).toBe('no-store');
      expect(r.redirect).toBe('error');
    }
    const draft = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId, versionId: draftId },
      origin,
      backend().send,
    );
    expect(draft).toMatchObject({
      kind: 'ready',
      selection: { kind: 'ready', selectedVersion: null },
    });
  });

  it('requests one bounded page at a time and selects an older version with its cursor', async () => {
    const firstPage = Array.from({ length: 40 }, (_, index) =>
      version({
        id: `123e4567-e89b-42d3-a456-${String(index + 101).padStart(12, '0')}`,
        version: 41 - index,
      }),
    );
    const first = backend(list(), publishedPage(firstPage, 2));
    const firstResult = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId, versionId },
      origin,
      first.send,
    );
    expect(firstResult.kind).toBe('ready');
    if (firstResult.kind !== 'ready' || firstResult.selection.kind !== 'ready') {
      throw new Error('Expected the first version page');
    }
    expect(firstResult.selection.versions).toHaveLength(40);
    expect(firstResult.selection.selectedVersion).toBeNull();
    expect(firstResult.selection.nextBeforeVersion).toBe(2);
    expect(first.calls).toHaveLength(2);

    const older = backend();
    const olderResult = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId, versionId, beforeVersion: 2 },
      origin,
      older.send,
    );
    expect(olderResult).toMatchObject({
      kind: 'ready',
      selection: {
        kind: 'ready',
        selectedVersion: { id: versionId, version: 1 },
        nextBeforeVersion: null,
      },
    });
    expect(new URL(older.calls[1]!.url).searchParams.get('beforeVersion')).toBe('2');
    expect(older.calls).toHaveLength(2);
  });

  it('allows published programs with newer DRAFT title previews, but no draft version choice', async () => {
    const newerDraft = record();
    newerDraft.versions[0]!.title = 'Unpublished title preview';
    newerDraft.versions[0]!.status = 'DRAFT';
    const selected = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId, versionId },
      origin,
      backend(list([newerDraft])).send,
    );
    expect(selected.kind).toBe('ready');
    if (selected.kind === 'ready') {
      expect(selected.programs[0]?.title).toBe('Unpublished title preview');
      expect(selected.selection.kind).toBe('ready');
      if (selected.selection.kind === 'ready') {
        expect(selected.selection.versions[0]?.title).toBe('Published plan v1');
      }
    }
  });

  it('does not send a user-controlled program URL for invalid, missing or off-page IDs', async () => {
    for (const raw of ['bad', foreignId, [programId], '', draftId]) {
      const { calls, send } = backend();
      const r = await loadTrainerProgramSelector(cookie, { page: 1, programId: raw }, origin, send);
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready') expect(r.selection).toEqual({ kind: 'not_found' });
      expect(calls).toHaveLength(1);
    }
  });

  it('does not select a forged, mismatched or absent version UUID', async () => {
    for (const raw of [foreignId, ['abc'], undefined]) {
      const r = await loadTrainerProgramSelector(
        cookie,
        { page: 1, programId, versionId: raw },
        origin,
        backend().send,
      );
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready' && r.selection.kind === 'ready') {
        expect(r.selection.selectedVersion).toBeNull();
      }
    }
  });

  it('accepts legitimately empty programs and page-two/out-of-range responses', async () => {
    const empty = await loadTrainerProgramSelector(
      cookie,
      { page: 1 },
      origin,
      backend(list([])).send,
    );
    expect(empty).toMatchObject({ kind: 'ready', programs: [], total: 0, totalPages: 0 });
    const out = await loadTrainerProgramSelector(
      cookie,
      { page: 3 },
      origin,
      backend(list([], 9, 3)).send,
    );
    expect(out).toMatchObject({ kind: 'ready', programs: [], total: 9, page: 3, totalPages: 2 });
  });

  it('handles published programs with no eligible published versions', async () => {
    const r = await loadTrainerProgramSelector(
      cookie,
      { page: 1, programId },
      origin,
      backend(list(), publishedPage([])).send,
    );
    expect(r.kind).toBe('ready');
    if (r.kind === 'ready') {
      expect(r.selection.kind).toBe('ready');
      if (r.selection.kind === 'ready') expect(r.selection.versions).toEqual([]);
    }
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('rejects program list status %i', async (status, kind) => {
    let calls = 0;
    const send: typeof fetch = async () => {
      calls++;
      return new Response(null, { status });
    };
    expect(await loadTrainerProgramSelector(cookie, { page: 1, programId }, origin, send)).toEqual({
      kind,
    });
    expect(calls).toBe(1);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ] as const)(
    'hides all previous client data if a selected version lookup returns %i',
    async (status, kind) => {
      let calls = 0;
      const send: typeof fetch = async () => {
        calls++;
        return calls === 1 ? Response.json(list()) : new Response(null, { status });
      };
      expect(
        await loadTrainerProgramSelector(cookie, { page: 1, programId }, origin, send),
      ).toEqual({ kind });
      expect(calls).toBe(2);
    },
  );

  it.each([
    [404, 'not_found'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('isolates inaccessible program versions HTTP %i', async (status, kind) => {
    let calls = 0;
    const send: typeof fetch = async () => {
      calls++;
      return calls === 1 ? Response.json(list()) : new Response(null, { status });
    };
    const r = await loadTrainerProgramSelector(cookie, { page: 1, programId }, origin, send);
    expect(r.kind).toBe('ready');
    if (r.kind === 'ready') expect(r.selection).toEqual({ kind });
    expect(calls).toBe(2);
  });

  it('rejects mixed-owner statuses and malformed list metadata instead of rendering private rows', async () => {
    const malformed = [
      list([record(programId, 'Archived', 'ARCHIVED')]),
      list([record(programId, 'Draft', 'DRAFT')]),
      list([record(), record()]),
      list(
        Array.from({ length: 9 }, (_, i) => record(i === 0 ? programId : foreignId)),
        9,
      ),
      { ...list(), meta: { ...list().meta, total: -1 } },
      { ...list(), meta: { ...list().meta, take: 100 } },
      { ...list(), meta: { ...list().meta, skip: 8 } },
      { ...list(), meta: { ...list().meta, totalPages: 11 } },
      list([record(), record(foreignId)], 1),
      list([{ ...record(), versions: [] }]),
    ];
    for (const input of malformed) {
      expect(
        await loadTrainerProgramSelector(cookie, { page: 1 }, origin, backend(input).send),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('rejects forged, duplicated, malformed or excessive version list payloads', async () => {
    const bad = [
      [version()],
      publishedPage([version({ programId: foreignId })]),
      publishedPage([version({ version: 2 }), version()]),
      publishedPage([version(), version({ id: draftId, version: 2 })]),
      publishedPage([version({ id: 'invalid' })]),
      publishedPage([version({ version: -1 })]),
      publishedPage([version({ title: '' })]),
      publishedPage([version({ status: 'DRAFT' })]),
      publishedPage([version({ status: 'ARCHIVED' })]),
      publishedPage([version({ publishedAt: null })]),
      publishedPage([version({ publishedAt: 'invalid-date' })]),
      publishedPage([version()], 1),
      { data: [version()] },
      publishedPage(Array.from({ length: 41 }, () => version())),
    ];
    for (const data of bad) {
      const r = await loadTrainerProgramSelector(
        cookie,
        { page: 1, programId, versionId },
        origin,
        backend(list(), data).send,
      );
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready') expect(r.selection).toEqual({ kind: 'unavailable' });
    }
  });

  it('rejects a version at or beyond the requested cursor', async () => {
    const { send } = backend(list(), publishedPage([version({ version: 2 })]));
    await expect(
      loadTrainerProgramSelector(cookie, { page: 1, programId, beforeVersion: 2 }, origin, send),
    ).resolves.toMatchObject({ kind: 'ready', selection: { kind: 'unavailable' } });
  });

  it('does not send the session cookie to unsafe hosts, redirects or unexpected transport errors', async () => {
    let sent = 0;
    const send: typeof fetch = async () => {
      sent++;
      return Response.json(list());
    };
    expect(
      await loadTrainerProgramSelector(
        cookie,
        { page: 1, programId, versionId },
        'https://user:password@hostile.test',
        send,
      ),
    ).toEqual({ kind: 'unavailable' });
    expect(sent).toBe(0);
    for (const failure of [
      async () =>
        new Response(null, { status: 302, headers: { location: 'https://hostile.test' } }),
      async () => new Response('{broken', { status: 200 }),
      async () => {
        throw new Error('private API failure');
      },
    ]) {
      expect(await loadTrainerProgramSelector(cookie, { page: 1 }, origin, failure)).toEqual({
        kind: 'unavailable',
      });
    }
  });
});
