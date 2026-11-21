import { describe, expect, it } from 'vitest';

import { assignTrainerVersion } from '../src/features/training-programs/lib/assign-trainer-version';

const relationId = '123e4567-e89b-42d3-a456-426614174000';
const programId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const assignmentId = '123e4567-e89b-42d3-a456-426614174003';

const created = {
  id: assignmentId,
  versionId,
  trainerAthleteId: relationId,
  status: 'ACTIVE',
  version: { id: versionId, programId },
};

function backend(body: unknown = created, status = 201) {
  const calls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  const send: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json(body, { status });
  };
  return { calls, send };
}

describe('Trainer program assignment POST boundaries', () => {
  it('sends precisely one typed JSON POST using browser-owned HttpOnly cookies and strict same-origin path', async () => {
    const { calls, send } = backend();
    expect(await assignTrainerVersion(relationId, programId, versionId, send)).toEqual({
      kind: 'created',
      assignmentId,
    });
    expect(calls).toHaveLength(1);
    const request = calls[0]!;
    expect(request.input).toBe(
      `/backend/training-programs/${programId}/versions/${versionId}/assignments`,
    );
    expect(request.init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ trainerAthleteId: relationId }),
    });
    expect(request.init?.signal).toBeInstanceOf(AbortSignal);
    expect(request.init?.headers).not.toHaveProperty('authorization');
    expect(String(request.init?.body)).not.toContain('token');
  });

  it.each([
    ['bad', programId, versionId],
    [relationId, '../other', versionId],
    [relationId, programId, 'not-uuid'],
    [relationId, programId, 'https://hostile.test'],
    ['', programId, versionId],
  ])(
    'rejects malformed IDs locally and never performs a write',
    async (relation, program, version) => {
      const { calls, send } = backend();
      expect(await assignTrainerVersion(relation, program, version, send)).toEqual({
        kind: 'invalid',
      });
      expect(calls).toHaveLength(0);
    },
  );

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [400, 'invalid'],
    [422, 'invalid'],
    [429, 'rate_limited'],
    [500, 'uncertain'],
    [502, 'uncertain'],
    [503, 'uncertain'],
  ] as const)('maps HTTP %i deterministically, without retry', async (status, kind) => {
    const { calls, send } = backend({ error: 'rejected' }, status);
    expect(await assignTrainerVersion(relationId, programId, versionId, send)).toEqual({ kind });
    expect(calls).toHaveLength(1);
  });

  it('never claims success when a 201 response is empty, mismatched or malformed', async () => {
    for (const body of [
      {},
      null,
      { ...created, id: 'bad' },
      { ...created, status: 'PENDING' },
      { ...created, trainerAthleteId: 'foreign' },
      { ...created, versionId: 'other-version' },
      { ...created, version: { ...created.version, id: 'other-version' } },
      { ...created, version: { ...created.version, programId: 'other-program' } },
      { ...created, version: undefined },
    ]) {
      const { calls, send } = backend(body);
      expect(await assignTrainerVersion(relationId, programId, versionId, send)).toEqual({
        kind: 'uncertain',
      });
      expect(calls).toHaveLength(1);
    }
  });

  it('treats a lost response, redirect, timeout and corrupt JSON as ambiguous; no second POST', async () => {
    for (const send of [
      async () => {
        throw new TypeError('lost response');
      },
      async () => {
        throw new DOMException('signal aborted', 'AbortError');
      },
      async () => new Response(null, { status: 307, headers: { location: 'https://evil.test' } }),
      async () => new Response('{not-json', { status: 201 }),
      async () => new Response(null, { status: 201 }),
    ]) {
      let posts = 0;
      expect(
        await assignTrainerVersion(relationId, programId, versionId, async () => {
          posts++;
          return send();
        }),
      ).toEqual({ kind: 'uncertain' });
      expect(posts).toBe(1);
    }
  });
});
