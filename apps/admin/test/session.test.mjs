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
