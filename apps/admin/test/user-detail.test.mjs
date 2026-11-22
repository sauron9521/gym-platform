import assert from 'node:assert/strict';
import { test } from 'vitest';

import { readAdminUserDetail, accountIdPattern } from '../src/shared/api/admin-user-detail.ts';

const id = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const origin = 'http://127.0.0.1:3001';
const account = {
  id,
  email: 'athlete@example.test',
  role: 'ATHLETE',
  status: 'ACTIVE',
  emailVerified: true,
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-21T00:00:00.000Z',
};
const reply =
  (status, body = account) =>
  async () =>
    new Response(JSON.stringify(body), { status });

test('only valid UUID account IDs may reach a trusted server-only endpoint', async () => {
  assert.equal(accountIdPattern.test(id), true);
  for (const malformed of ['invalid', '../users', 'abc%2Fother', '', 'a'.repeat(150)]) {
    let requests = 0;
    assert.deepEqual(
      await readAdminUserDetail('sid=secret', malformed, origin, async () => {
        requests++;
        throw new Error('Must not request invalid path');
      }),
      { kind: 'invalid' },
    );
    assert.equal(requests, 0);
  }
  assert.deepEqual(await readAdminUserDetail('', id, origin, reply(200)), {
    kind: 'unauthenticated',
  });
});

test('operator details sends cookie only to fixed internal endpoint, never caches', async () => {
  let requested;
  let options;
  const result = await readAdminUserDetail('sid=private', id, origin, async (url, init) => {
    requested = url;
    options = init;
    return new Response(JSON.stringify(account), { status: 200 });
  });
  assert.deepEqual(result, { kind: 'ready', user: account });
  assert.equal(requested, origin + '/admin/users/' + id);
  assert.equal(options.headers.cookie, 'sid=private');
  assert.equal(options.headers.accept, 'application/json');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  assert.equal(options.signal instanceof AbortSignal, true);
});

test('cannot read details without explicit API permission or after account disappears', async () => {
  for (const [status, kind] of [
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [429, 'unavailable'],
    [503, 'unavailable'],
    [302, 'unavailable'],
  ]) {
    assert.deepEqual(await readAdminUserDetail('sid=private', id, origin, reply(status)), { kind });
  }
  for (const unsafe of [
    '',
    'https://u:secret@example.test',
    'file:///tmp/users',
    'http://localhost:3001/wrong',
  ]) {
    let called = false;
    assert.deepEqual(
      await readAdminUserDetail('sid=private', id, unsafe, async () => {
        called = true;
        return new Response(JSON.stringify(account));
      }),
      { kind: 'unavailable' },
    );
    assert.equal(called, false);
  }
  assert.deepEqual(
    await readAdminUserDetail('sid=private', id, origin, async () => {
      throw new Error('Do not expose upstream failure');
    }),
    { kind: 'unavailable' },
  );
});

test('supports persisted suspended user detail read without account mutation', async () => {
  const suspended = { ...account, status: 'SUSPENDED' };
  assert.deepEqual(await readAdminUserDetail('sid=private', id, origin, reply(200, suspended)), {
    kind: 'ready',
    user: suspended,
  });
});

test('never render extra PII, mismatched ID or malformed API data', async () => {
  const invalid = [
    { ...account, passwordHash: 'secret' },
    { ...account, profile: { birthday: '2000-01-01' } },
    { ...account, sessions: [] },
    { ...account, id: 'd09c7567-626e-45d8-99f1-829ce4204fbd' },
    { ...account, email: null },
    { ...account, role: 'SUPERADMIN' },
    { ...account, status: 'BANNED' },
    { ...account, emailVerified: 'yes' },
    { ...account, createdAt: 'not-date' },
    { ...account, updatedAt: 100 },
    null,
    [],
  ];
  for (const body of invalid) {
    assert.deepEqual(await readAdminUserDetail('sid=private', id, origin, reply(200, body)), {
      kind: 'unavailable',
    });
  }
  assert.deepEqual(
    await readAdminUserDetail(
      'sid=private',
      id,
      origin,
      async () => new Response('not json', { status: 200 }),
    ),
    { kind: 'unavailable' },
  );
});
