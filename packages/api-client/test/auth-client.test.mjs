import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyAuthFailure,
  createBrowserSessionClient,
  createBearerTokenClient,
} from '../src/index.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

test('classifies authentication failure without collapsing 401 and 403', () => {
  assert.equal(classifyAuthFailure(401), 'unauthenticated');
  assert.equal(classifyAuthFailure(403), 'forbidden');
  assert.equal(classifyAuthFailure(400), null);
  assert.equal(classifyAuthFailure(500), null);
});

test('browser session client opts into cookies without adding an Authorization header', async () => {
  let seen;
  const client = createBrowserSessionClient({
    baseUrl: 'https://api.example.test',
    fetch: async (request) => {
      seen = request;
      return json({ id: 'abc' });
    },
  });

  await client.GET('/users/me');

  assert.equal(seen?.credentials, 'include');
  assert.equal(seen?.headers.get('authorization'), null);
});

test('401 and 403 dispatch distinct callbacks without consuming the response', async () => {
  const events = [];
  let status = 401;
  const client = createBrowserSessionClient({
    baseUrl: 'https://api.example.test',
    onAuthFailure: async (event) => events.push(event),
    fetch: async () => json({ message: 'Access denied' }, status),
  });

  const first = await client.GET('/users/me');
  status = 403;
  const second = await client.GET('/users/me');

  assert.deepEqual(events, ['unauthenticated', 'forbidden']);
  assert.equal(first.response.status, 401);
  assert.equal(second.response.status, 403);
});

test('bearer client attaches callback-provided token without browser cookies', async () => {
  let seen;
  const client = createBearerTokenClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'short-lived-access-token',
    fetch: async (request) => {
      seen = request;
      return json({ id: 'abc' });
    },
  });

  await client.GET('/users/me');
  assert.equal(seen?.headers.get('authorization'), 'Bearer short-lived-access-token');
  assert.equal(seen?.credentials, 'omit');
  assert.equal(seen?.redirect, 'error');
});

test('bearer client clears stale auth headers when no access token exists', async () => {
  let seen;
  const client = createBearerTokenClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => undefined,
    headers: { Authorization: 'Bearer stale-token' },
    fetch: async (request) => {
      seen = request;
      return json({ status: 'ok' });
    },
  });

  await client.GET('/health/live');
  assert.equal(seen?.headers.get('authorization'), null);
});

test('bearer client reports 401 once and never attempts automatic token refresh', async () => {
  let requests = 0;
  const failures = [];
  const client = createBearerTokenClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'expired-token',
    onAuthFailure: (failure) => failures.push(failure),
    fetch: async () => {
      requests++;
      return json({ message: 'expired' }, 401);
    },
  });

  const result = await client.GET('/users/me');
  assert.equal(result.response.status, 401);
  assert.equal(requests, 1);
  assert.deepEqual(failures, ['unauthenticated']);
});

test('bearer client rejects non-http origins and missing base URLs', () => {
  assert.throws(
    () => createBearerTokenClient({ getAccessToken: () => 'token' }),
    /baseUrl/,
  );
  assert.throws(
    () =>
      createBearerTokenClient({
        baseUrl: 'file:///tmp/data',
        getAccessToken: () => 'token',
      }),
    /HTTP\(S\)/,
  );
});
