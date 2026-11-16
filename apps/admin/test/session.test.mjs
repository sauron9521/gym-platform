import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readAdminSession } from '../src/shared/api/admin-session.ts';

const endpoint = 'http://127.0.0.1:3001';

function reply(status, user) {
  return async () => new Response(JSON.stringify(user), { status });
}

test('private dashboard requires a real cookie and healthy upstream', async () => {
  assert.deepEqual(await readAdminSession('', endpoint), { kind: 'unauthenticated' });
  assert.deepEqual(await readAdminSession('sid=test', undefined, reply(500)), {
    kind: 'unavailable',
  });
  assert.deepEqual(await readAdminSession('sid=test', 'http://user:pwd@host', reply(200)), {
    kind: 'unavailable',
  });
});

test('only the ADMIN principal may see the administration shell', async () => {
  const admin = await readAdminSession('sid=test', endpoint, reply(200, {
    id: 'admin-id',
    role: 'ADMIN',
  }));
  assert.deepEqual(admin, { kind: 'admin', id: 'admin-id' });

  const athlete = await readAdminSession('sid=test', endpoint, reply(200, {
    id: 'athlete-id',
    role: 'ATHLETE',
  }));
  assert.deepEqual(athlete, { kind: 'forbidden' });
  assert.deepEqual(await readAdminSession('sid=test', endpoint, reply(401)), {
    kind: 'unauthenticated',
  });
  assert.deepEqual(await readAdminSession('sid=test', endpoint, reply(403)), {
    kind: 'forbidden',
  });
});
