import { describe, expect, it } from 'vitest';

import {
  loadTrainerProgramSelector,
  parseProgramChoicePage,
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

function backend(programs: unknown = list(), versions: unknown = [version()]) {
  const calls: Request[] = [];
  const send: typeof fetch = async (input) => {
    const request = new Request(input);
    calls.push(request);
    return Response.json(request.url.includes('/versions') ? versions : programs);
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

  it('never sends an API request for missing credentials or unsafe pagination', async () => {
    const { calls, send } = backend();
    expect(await loadTrainerProgramSelector('', 1, undefined, undefined, origin, send)).toEqual({
      kind: 'unauthenticated',
    });
    for (const page of [0, -1, 1.5, Number.NaN, 10001]) {
      expect(
        await loadTrainerProgramSelector(cookie, page, undefined, undefined, origin, send),
      ).toEqual({ kind: 'unavailable' });
    }
    expect(calls).toHaveLength(0);
  });

  it('makes exactly one trusted owner-scoped, PUBLISHED-only bounded read initially', async () => {
    const { calls, send } = backend();
    expect(await loadTrainerProgramSelector(cookie, 1, undefined, undefined, origin, send)).toEqual(
      {
        kind: 'ready',
        programs: [{ id: programId, title: 'My program' }],
        total: 1,
        page: 1,
        totalPages: 1,
        selection: { kind: 'none' },
      },
    );
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

  it('selects only PUBLISHED versions; draft cannot be selected even if its UUID is injected', async () => {
    const versions = [
      version({
        id: draftId,
        version: 2,
        title: 'Hidden draft',
        status: 'DRAFT',
        publishedAt: null,
      }),
      version(),
    ];
    const { calls, send } = backend(list(), versions);
    const selected = await loadTrainerProgramSelector(
      cookie,
      1,
      programId,
      versionId,
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
        selectedVersion: { id: versionId, title: 'Published plan v1', version: 1 },
      },
    });
    expect(calls.map((r) => new URL(r.url).pathname)).toEqual([
      '/training-programs',
      `/training-programs/${programId}/versions`,
    ]);
    for (const r of calls) {
      expect(r.method).toBe('GET');
      expect(r.headers.get('cookie')).toBe(cookie);
      expect(r.cache).toBe('no-store');
      expect(r.redirect).toBe('error');
    }
    const draft = await loadTrainerProgramSelector(
      cookie,
      1,
      programId,
      draftId,
      origin,
      backend(list(), versions).send,
    );
    expect(draft.kind).toBe('ready');
    if (draft.kind === 'ready') {
      expect(draft.selection.kind).toBe('ready');
      if (draft.selection.kind === 'ready') {
        expect(draft.selection.selectedVersion).toBeNull();
        expect(draft.selection.versions.some((v) => v.title === 'Hidden draft')).toBe(false);
      }
    }
  });

  it('allows published programs with newer DRAFT title previews, but no draft version choice', async () => {
    const newerDraft = record();
    newerDraft.versions[0]!.title = 'Unpublished title preview';
    newerDraft.versions[0]!.status = 'DRAFT';
    const selected = await loadTrainerProgramSelector(
      cookie,
      1,
      programId,
      versionId,
      origin,
      backend(list([newerDraft]), [version()]).send,
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
      const r = await loadTrainerProgramSelector(cookie, 1, raw, undefined, origin, send);
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready') expect(r.selection).toEqual({ kind: 'not_found' });
      expect(calls).toHaveLength(1);
    }
  });

  it('does not select a forged, mismatched or absent version UUID', async () => {
    for (const raw of [foreignId, ['abc'], undefined]) {
      const r = await loadTrainerProgramSelector(cookie, 1, programId, raw, origin, backend().send);
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready' && r.selection.kind === 'ready') {
        expect(r.selection.selectedVersion).toBeNull();
      }
    }
  });

  it('accepts legitimately empty programs and page-two/out-of-range responses', async () => {
    const empty = await loadTrainerProgramSelector(
      cookie,
      1,
      undefined,
      undefined,
      origin,
      backend(list([])).send,
    );
    expect(empty).toMatchObject({ kind: 'ready', programs: [], total: 0, totalPages: 0 });
    const out = await loadTrainerProgramSelector(
      cookie,
      3,
      undefined,
      undefined,
      origin,
      backend(list([], 9, 3)).send,
    );
    expect(out).toMatchObject({ kind: 'ready', programs: [], total: 9, page: 3, totalPages: 2 });
  });

  it('handles published programs with no eligible published versions', async () => {
    const r = await loadTrainerProgramSelector(
      cookie,
      1,
      programId,
      undefined,
      origin,
      backend(list(), [version({ status: 'DRAFT', publishedAt: null })]).send,
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
    expect(await loadTrainerProgramSelector(cookie, 1, programId, undefined, origin, send)).toEqual(
      { kind },
    );
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
        await loadTrainerProgramSelector(cookie, 1, programId, undefined, origin, send),
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
    const r = await loadTrainerProgramSelector(cookie, 1, programId, undefined, origin, send);
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
        await loadTrainerProgramSelector(
          cookie,
          1,
          undefined,
          undefined,
          origin,
          backend(input).send,
        ),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('rejects forged, duplicated, malformed or excessive version list payloads', async () => {
    const bad = [
      [version({ programId: foreignId })],
      [version(), version()],
      [version({ id: 'invalid' })],
      [version({ version: -1 })],
      [version({ title: '' })],
      [version({ status: 'ARCHIVED' })],
      [version({ publishedAt: null })],
      [version({ publishedAt: 'invalid-date' })],
      Array.from({ length: 41 }, (_, i) => version({ id: `fake-${i}`, version: i + 1 })),
    ];
    for (const data of bad) {
      const r = await loadTrainerProgramSelector(
        cookie,
        1,
        programId,
        versionId,
        origin,
        backend(list(), data).send,
      );
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready') expect(r.selection).toEqual({ kind: 'unavailable' });
    }
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
        1,
        programId,
        versionId,
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
      expect(
        await loadTrainerProgramSelector(cookie, 1, undefined, undefined, origin, failure),
      ).toEqual({ kind: 'unavailable' });
    }
  });
});
