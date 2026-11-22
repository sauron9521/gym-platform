import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  parseDirectoryFilters,
  directoryPageHref,
  readAdminDirectory,
} from '../src/shared/api/admin-directory.ts';

const endpoint = 'http://127.0.0.1:3001';
const filters = { page: 2, search: 'exa', role: 'TRAINER' };
const uuid = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const row = {
  id: uuid,
  email: 'trainer@example.test',
  role: 'TRAINER',
  status: 'ACTIVE',
  createdAt: '2026-11-22T01:00:00.000Z',
};
const payload = {
  data: [row],
  meta: { total: 21, skip: 20, take: 20, totalPages: 2 },
};
const respond =
  (status, body = payload) =>
  async () =>
    new Response(JSON.stringify(body), { status });

test('directory query accepts strict bounded filters and preserves them in pagination links', () => {
  assert.deepEqual(parseDirectoryFilters({}), {
    kind: 'valid',
    filters: { page: 1, search: '', role: '' },
  });
  assert.deepEqual(parseDirectoryFilters({ page: '2', search: '  exa  ', role: 'TRAINER' }), {
    kind: 'valid',
    filters,
  });
  assert.equal(directoryPageHref(filters, 1), '/users?search=exa&role=TRAINER');
  assert.equal(directoryPageHref(filters, 3), '/users?search=exa&role=TRAINER&page=3');
  assert.equal(directoryPageHref({ page: 1, search: '', role: '' }, 1), '/users');
  for (const query of [
    { page: '0' },
    { page: '10001' },
    { page: 'NaN' },
    { page: ['1', '2'] },
    { search: 'a' },
    { search: 'a'.repeat(101) },
    { role: 'SUPERADMIN' },
    { role: ['TRAINER'] },
    { status: 'SUSPENDED' },
    { search: 'valid', deletedAt: 'any' },
  ]) {
    assert.deepEqual(parseDirectoryFilters(query), { kind: 'invalid' });
  }
});

test('operator directory sends credentials to fixed trusted internal API only, never caches', async () => {
  let seenUrl;
  let options;
  const result = await readAdminDirectory('sid=secret', filters, endpoint, async (url, init) => {
    seenUrl = url;
    options = init;
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  assert.deepEqual(result, { kind: 'ready', ...payload });
  assert.equal(seenUrl, endpoint + '/admin/users?page=2&limit=20&search=exa&role=TRAINER');
  assert.equal(options.headers.cookie, 'sid=secret');
  assert.equal(options.headers.accept, 'application/json');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  assert.equal(options.signal instanceof AbortSignal, true);
});

test('accepts persisted SUSPENDED as a public operator-only account status', async () => {
  const suspended = { ...payload, data: [{ ...row, status: 'SUSPENDED' }] };
  assert.deepEqual(
    await readAdminDirectory('sid=foo', filters, endpoint, respond(200, suspended)),
    { kind: 'ready', ...suspended },
  );
});

test('401, 403, missing cookies, invalid upstream and upstream failures all fail closed', async () => {
  assert.deepEqual(await readAdminDirectory('', filters, endpoint, respond(200)), {
    kind: 'unauthenticated',
  });
  assert.deepEqual(await readAdminDirectory('sid=foo', filters, endpoint, respond(401)), {
    kind: 'unauthenticated',
  });
  assert.deepEqual(await readAdminDirectory('sid=foo', filters, endpoint, respond(403)), {
    kind: 'forbidden',
  });
  for (const status of [302, 404, 429, 500]) {
    assert.deepEqual(await readAdminDirectory('sid=foo', filters, endpoint, respond(status)), {
      kind: 'unavailable',
    });
  }
  for (const config of [
    '',
    'https://evil:secret@example.test',
    'https://example.test/other',
    'file:///etc/passwd',
  ]) {
    let calls = 0;
    assert.deepEqual(
      await readAdminDirectory('sid=foo', filters, config, async () => {
        calls += 1;
        return new Response(JSON.stringify(payload), { status: 200 });
      }),
      { kind: 'unavailable' },
    );
    assert.equal(calls, 0);
  }
  assert.deepEqual(
    await readAdminDirectory('sid=foo', filters, endpoint, async () => {
      throw new Error('Private connection string');
    }),
    { kind: 'unavailable' },
  );
});

test('unexpected account fields or meta cause fail closed with no PII exposed', async () => {
  for (const body of [
    { ...payload, data: [{ ...row, passwordHash: 'secret' }] },
    { ...payload, data: [{ ...row, deletedAt: null }] },
    { ...payload, data: [{ ...row, status: 'BANNED' }] },
    { ...payload, data: [{ ...row, email: null }] },
    { ...payload, data: [{ ...row, id: 'not-uuid' }] },
    { ...payload, data: [{ ...row, createdAt: 'not-a-date' }] },
    { ...payload, meta: { ...payload.meta, take: 999 } },
    { ...payload, meta: { ...payload.meta, skip: 0 } },
    { ...payload, meta: { ...payload.meta, totalPages: 9 } },
    { ...payload, meta: { ...payload.meta, internal: 'secret' } },
    { ...payload, data: [...Array(21)].map(() => row) },
    { data: [], meta: payload.meta, credentials: 'secret' },
  ]) {
    assert.deepEqual(await readAdminDirectory('sid=foo', filters, endpoint, respond(200, body)), {
      kind: 'unavailable',
    });
  }
  assert.deepEqual(
    await readAdminDirectory(
      'sid=foo',
      filters,
      endpoint,
      async () => new Response('invalid json', { status: 200 }),
    ),
    { kind: 'unavailable' },
  );
});
