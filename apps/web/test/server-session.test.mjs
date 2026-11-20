import assert from 'node:assert/strict';
import { test } from 'vitest';

import { verifyServerCapability, verifyServerSession } from '../src/shared/api/server-session.ts';
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

test('capability guard allows a persisted ATHLETE trainer, even if /users/me role is ATHLETE', async () => {
  const seen = [];
  const result = await verifyServerCapability(
    '__Host-sid=opaque',
    'trainer',
    'https://api.internal.test',
    async (url, init) => {
      seen.push({ url, init });
      return Response.json(
        url.endsWith('/capabilities')
          ? { athlete: true, trainer: true, admin: false }
          : account,
      );
    },
  );

  assert.equal(result.kind, 'authenticated');
  assert.equal(result.user.role, 'ATHLETE');
  assert.deepEqual(seen.map(({ url }) => url), [
    'https://api.internal.test/users/me',
    'https://api.internal.test/users/me/capabilities',
  ]);
  for (const { init } of seen) {
    assert.equal(init.headers.cookie, '__Host-sid=opaque');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
  }
});

test('capability guard denies revoked TRAINER roles while preserving athlete access', async () => {
  const legacyTrainer = { ...account, role: 'TRAINER' };
  const send = async (url) =>
    Response.json(
      url.endsWith('/capabilities')
        ? { athlete: true, trainer: false, admin: false }
        : legacyTrainer,
    );

  assert.deepEqual(
    await verifyServerCapability('__Host-sid=stale', 'trainer', 'https://api.internal.test', send),
    { kind: 'forbidden' },
  );
  const athlete = await verifyServerCapability(
    '__Host-sid=stale',
    'athlete',
    'https://api.internal.test',
    send,
  );
  assert.equal(athlete.kind, 'authenticated');
  assert.equal(athlete.user.role, 'TRAINER');
});

test('capability guard does not trust an ADMIN role or an inconsistent admin grant', async () => {
  const granted = await verifyServerCapability(
    '__Host-sid=old',
    'athlete',
    'https://api.internal.test',
    async (url) =>
      Response.json(
        url.endsWith('/capabilities')
          ? { athlete: true, trainer: true, admin: true }
          : account,
      ),
  );
  assert.deepEqual(granted, { kind: 'forbidden' });
});

test('capability guard fails closed on auth failures, malformed grants, outages and redirects', async () => {
  let calls = 0;
  const notSignedIn = await verifyServerCapability('', 'trainer', 'https://api.internal.test', async () => {
    calls += 1;
    throw new Error('should not fetch');
  });
  assert.deepEqual(notSignedIn, { kind: 'unauthenticated' });
  assert.equal(calls, 0);

  for (const [status, expected] of [
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [429, 'unavailable'],
    [503, 'unavailable'],
  ]) {
    const result = await verifyServerCapability(
      '__Host-sid=old',
      'trainer',
      'https://api.internal.test',
      async (url) =>
        url.endsWith('/capabilities')
          ? new Response(null, { status })
          : Response.json(account),
    );
    assert.equal(result.kind, expected);
  }

  const malformed = await verifyServerCapability(
    '__Host-sid=old',
    'trainer',
    'https://api.internal.test',
    async (url) =>
      Response.json(
        url.endsWith('/capabilities') ? { athlete: true, trainer: 'yes', admin: false } : account,
      ),
  );
  assert.deepEqual(malformed, { kind: 'unavailable' });

  const offline = await verifyServerCapability(
    '__Host-sid=old',
    'trainer',
    'https://api.internal.test',
    async (url) => {
      if (url.endsWith('/capabilities')) throw new Error('network is offline');
      return Response.json(account);
    },
  );
  assert.deepEqual(offline, { kind: 'unavailable' });
});
