import assert from 'node:assert/strict';
import { test } from 'vitest';

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

test('admin verification only forwards the cookie to an uncached fixed endpoint', async () => {
  let requestedUrl;
  let requestOptions;

  const send = async (url, options) => {
    requestedUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify({ id: 'admin-id', role: 'ADMIN' }), { status: 200 });
  };

  const session = await readAdminSession('sid=private', endpoint, send);
  assert.deepEqual(session, { kind: 'admin', id: 'admin-id' });
  assert.equal(requestedUrl, endpoint + '/users/me');
  assert.equal(requestOptions.headers.cookie, 'sid=private');
  assert.equal(requestOptions.cache, 'no-store');
  assert.equal(requestOptions.redirect, 'error');
});

test('admin verification refuses redirects, empty user IDs and unexpected API paths', async () => {
  const invalidUser = { id: '', role: 'ADMIN' };
  const invalid = await readAdminSession('sid=test', endpoint, reply(200, invalidUser));
  assert.deepEqual(invalid, { kind: 'unavailable' });

  const redirected = await readAdminSession('sid=test', endpoint, reply(302));
  assert.deepEqual(redirected, { kind: 'unavailable' });

  const invalidUrl = await readAdminSession('sid=test', endpoint + '/other', reply(200));
  assert.deepEqual(invalidUrl, { kind: 'unavailable' });
});
