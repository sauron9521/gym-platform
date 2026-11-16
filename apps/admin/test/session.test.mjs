import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readAdminSession } from '../src/shared/api/admin-session.ts';

const endpoint = 'http://127.0.0.1:3001';

function reply(status, user) {
  return async () => new Response(JSON.stringify(user), { status });
}

test('private dashboard requires a real cookie and healthy upstream', async () => {
  const missing = await readAdminSession('', endpoint);
  assert.deepEqual(missing, { kind: 'unauthenticated' });

  const unreachable = await readAdminSession('sid=test', undefined, reply(500));
  assert.deepEqual(unreachable, { kind: 'unavailable' });

  const untrusted = await readAdminSession('sid=test', 'http://user:pwd@host', reply(200));
  assert.deepEqual(untrusted, { kind: 'unavailable' });
});

test('only the ADMIN principal may see the administration shell', async () => {
  const adminUser = { id: 'admin-id', role: 'ADMIN' };
  const admin = await readAdminSession('sid=test', endpoint, reply(200, adminUser));
  assert.deepEqual(admin, { kind: 'admin', id: 'admin-id' });

  const athleteUser = { id: 'athlete-id', role: 'ATHLETE' };
  const athlete = await readAdminSession('sid=test', endpoint, reply(200, athleteUser));
  assert.deepEqual(athlete, { kind: 'forbidden' });

  const unsigned = await readAdminSession('sid=test', endpoint, reply(401));
  assert.deepEqual(unsigned, { kind: 'unauthenticated' });

  const forbidden = await readAdminSession('sid=test', endpoint, reply(403));
  assert.deepEqual(forbidden, { kind: 'forbidden' });
});

test('admin session request forwards only the cookie to the fixed uncached API endpoint', async () => {
  let calls = 0;
  const send = async (url, options) => {
    calls += 1;
    assert.equal(url, endpoint + '/users/me');
    assert.deepEqual(options.headers, {
      cookie: 'session=private-session',
      accept: 'application/json',
    });
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ id: 'admin-id', role: 'ADMIN' }), { status: 200 });
  };
  assert.deepEqual(
    await readAdminSession('session=private-session', endpoint, send),
    { kind: 'admin', id: 'admin-id' },
  );
  assert.equal(calls, 1);
});

test('admin session fails closed on malformed identities, redirects and invalid upstream URLs', async () => {
  for (const user of [null, [], { id: '', role: 'ADMIN' }, { id: 123, role: 'ADMIN' }, { id: 'member', role: null }]) {
    assert.deepEqual(await readAdminSession('sid=test', endpoint, reply(200, user)), {
      kind: 'unavailable',
    });
  }
  assert.deepEqual(await readAdminSession('sid=test', endpoint, reply(302)), {
    kind: 'unavailable',
  });
  for (const configured of [
    'file:///etc/passwd',
    'https://api.example.test/other-path',
    'https://api.example.test/?credential=secret',
    'http://username:password@api.example.test',
  ]) {
    assert.deepEqual(
      await readAdminSession('sid=test', configured, reply(200, { id: 'admin-id', role: 'ADMIN' })),
      { kind: 'unavailable' },
    );
  }
});
