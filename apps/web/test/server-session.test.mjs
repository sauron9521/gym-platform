import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyServerSession } from '../src/shared/api/server-session.ts';
import { getApiUpstreamOrigin } from '../src/shared/api/upstream.mjs';

const account = {
  id: 'account-1',
  email: 'athlete@example.test',
  role: 'ATHLETE',
  profile: { firstName: 'Athlete', displayName: 'Athlete A' },
};

test('upstream rejects credentialed and path-bearing destinations', () => {
  assert.equal(getApiUpstreamOrigin('https://api.internal.test'), 'https://api.internal.test');
  assert.equal(getApiUpstreamOrigin(undefined), 'http://localhost:3001');

  for (const value of [
    'file:///tmp/data',
    'https://user:pass@api.test',
    'https://api.test/other',
    'https://api.test/?query=1',
    'https://api.test/#fragment',
  ]) {
    assert.throws(() => getApiUpstreamOrigin(value), /GYM_API_INTERNAL_URL/);
  }
});

test('missing cookies cannot unlock the dashboard or reach the backend', async () => {
  const result = await verifyServerSession('', 'https://api.internal.test', async () => {
    throw new Error('should not fetch');
  });
  assert.deepEqual(result, { kind: 'unauthenticated' });
});

test('server forwards only cookies and verifies the user with uncached requests', async () => {
  let urlSeen;
  let initSeen;
  const result = await verifyServerSession(
    'session=opaque-value',
    'https://api.internal.test',
    async (url, init) => {
      urlSeen = url;
      initSeen = init;
      return Response.json(account);
    },
  );

  assert.equal(urlSeen, 'https://api.internal.test/users/me');
  assert.equal(initSeen.headers.cookie, 'session=opaque-value');
  assert.equal(initSeen.cache, 'no-store');
  assert.equal(initSeen.redirect, 'error');
  assert.deepEqual(result, {
    kind: 'authenticated',
    user: {
      id: 'account-1',
      email: 'athlete@example.test',
      displayName: 'Athlete A',
      role: 'ATHLETE',
    },
  });
});

test('401, 403, invalid bodies and network failures never unlock content', async () => {
  const cases = [
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ];

  for (const [status, kind] of cases) {
    const result = await verifyServerSession(
      'session=opaque',
      'https://api.internal.test',
      async () => new Response(null, { status }),
    );
    assert.equal(result.kind, kind);
  }

  const malformed = await verifyServerSession(
    'session=opaque',
    'https://api.internal.test',
    async () => Response.json({ email: 'no-id@example.test' }),
  );
  assert.deepEqual(malformed, { kind: 'unavailable' });

  const offline = await verifyServerSession(
    'session=opaque',
    'https://api.internal.test',
    async () => {
      throw new Error('never expose this error');
    },
  );
  assert.deepEqual(offline, { kind: 'unavailable' });
});
