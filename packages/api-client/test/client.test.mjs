import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGymApiClient } from '../src/index.ts';

test('GET /health/live uses the configured base URL and returns typed data', async () => {
  let outgoing;
  const client = createGymApiClient({
    baseUrl: 'https://api.example.test',
    fetch: async (request) => {
      outgoing = request;
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const { data, error } = await client.GET('/health/live');
  assert.deepEqual(data, { status: 'ok' });
  assert.equal(error, undefined);
  assert.equal(outgoing?.url, 'https://api.example.test/health/live');
});

test('does not set Authorization headers without caller opt-in', async () => {
  let header;
  const client = createGymApiClient({
    baseUrl: 'https://api.example.test',
    fetch: async (request) => {
      header = request.headers.get('authorization');
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.GET('/health/live');
  assert.equal(header, null);
});
