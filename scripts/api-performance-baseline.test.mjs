import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, it } from 'vitest';

import {
  API_PERFORMANCE_ROUTES,
  nearestRank,
  readBaselineConfig,
  runBaseline,
  validateBaseUrl,
} from './api-performance-baseline.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

async function localServer(handler) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

describe('API performance baseline guardrails', () => {
  it('accepts local HTTP only and refuses remote hosts, credentials, paths or HTTPS', () => {
    assert.equal(validateBaseUrl('http://127.0.0.1:3001'), 'http://127.0.0.1:3001');
    assert.equal(validateBaseUrl('http://localhost:3001'), 'http://localhost:3001');
    for (const url of [
      'https://127.0.0.1:3001',
      'http://example.com:3001',
      'http://user:pass@localhost:3001',
      'http://localhost:3001/api',
      'http://localhost:3001/?token=secret',
    ]) {
      assert.throws(() => validateBaseUrl(url), /loopback HTTP origin/);
    }
  });

  it('requires a token, rejects unknown/duplicate routes and bounds sample sizes', () => {
    assert.throws(() => readBaselineConfig({}), /API_PERF_TOKEN/);
    assert.throws(
      () => readBaselineConfig({ API_PERF_TOKEN: 'secret', API_PERF_ROUTES: 'unknown' }),
      /Unsupported/,
    );
    assert.throws(
      () => readBaselineConfig({ API_PERF_TOKEN: 'secret', API_PERF_ROUTES: 'users-me,users-me' }),
      /unique/,
    );
    assert.throws(
      () => readBaselineConfig({ API_PERF_TOKEN: 'secret', API_PERF_SAMPLES: '1000' }),
      /API_PERF_SAMPLES/,
    );
    const config = readBaselineConfig({ API_PERF_TOKEN: 'secret' });
    assert.deepEqual(config.routes, API_PERFORMANCE_ROUTES);
    assert.equal(config.samples, 25);
  });

  it('uses nearest-rank p95 without interpolating small samples', () => {
    assert.equal(nearestRank([8, 3, 2, 1, 5], 50), 3);
    assert.equal(nearestRank([8, 3, 2, 1, 5], 95), 8);
    assert.throws(() => nearestRank([], 95), /No samples/);
    assert.throws(() => nearestRank([1], Number.NaN), /Invalid percentile/);
  });

  it('validates direct runner input before making any request', async () => {
    const valid = readBaselineConfig({ API_PERF_TOKEN: 'secret-token' });
    const invalid = [
      { baseUrl: 'http://example.com' },
      { routes: [{ name: 'users-me', path: '/unknown' }] },
      { routes: [valid.routes[0], valid.routes[0]] },
      { routes: [] },
      { samples: 41 },
      { warmup: -1 },
      { pauseMs: 5001 },
      { token: 'invalid token' },
    ];
    let requests = 0;
    for (const overrides of invalid) {
      await assert.rejects(
        runBaseline({ ...valid, ...overrides }, async () => {
          requests++;
          throw new Error('Unexpected request');
        }),
        /API_PERF_/,
      );
    }
    assert.equal(requests, 0);
    assert.ok(API_PERFORMANCE_ROUTES.every(Object.isFrozen));
  });

  it('omits raw transport and body-read errors', async () => {
    const config = readBaselineConfig({
      API_PERF_TOKEN: 'secret-token',
      API_PERF_ROUTES: 'users-me',
      API_PERF_SAMPLES: '1',
      API_PERF_WARMUP: '0',
      API_PERF_PAUSE_MS: '0',
    });
    const failure = () => {
      throw new Error('private transport detail secret-token');
    };
    for (const request of [failure, async () => ({ status: 200, arrayBuffer: failure })]) {
      await assert.rejects(runBaseline(config, request), (error) => {
        assert.match(error.message, /details omitted/);
        assert.doesNotMatch(error.message, /secret-token|private transport/);
        return true;
      });
    }
  });

  it('samples only GET responses, drops warmups, reports body size and never emits tokens or body', async () => {
    let count = 0;
    const url = await localServer((request, response) => {
      count++;
      assert.equal(request.method, 'GET');
      assert.equal(request.headers.authorization, 'Bearer secret-token');
      assert.equal(request.url, '/users/me');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ private: 'do-not-log', iteration: count }));
    });
    const config = readBaselineConfig({
      API_PERF_TOKEN: 'secret-token',
      API_PERF_BASE_URL: url,
      API_PERF_ROUTES: 'users-me',
      API_PERF_WARMUP: '1',
      API_PERF_SAMPLES: '3',
      API_PERF_PAUSE_MS: '0',
    });
    const result = await runBaseline(config);
    assert.equal(count, 4);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].samples, 3);
    assert.equal(
      result.results[0].decodedResponseBytes.p50,
      Buffer.byteLength('{"private":"do-not-log","iteration":3}'),
    );
    assert.ok(result.results[0].latencyMs.p95 >= 0);
    const printed = JSON.stringify(result);
    assert.doesNotMatch(printed, /secret-token|do-not-log|private/);
  });

  it('fails closed for non-200 responses and does not expose their body', async () => {
    const url = await localServer((_request, response) => {
      response.writeHead(429);
      response.end('private rate-limit details');
    });
    const config = readBaselineConfig({
      API_PERF_TOKEN: 'secret-token',
      API_PERF_BASE_URL: url,
      API_PERF_ROUTES: 'users-me',
      API_PERF_SAMPLES: '1',
      API_PERF_WARMUP: '0',
      API_PERF_PAUSE_MS: '0',
    });
    await assert.rejects(runBaseline(config), (error) => {
      assert.match(error.message, /HTTP 429/);
      assert.doesNotMatch(error.message, /private|secret-token/);
      return true;
    });
  });
});
