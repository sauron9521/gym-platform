import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { validateLoadReport } from './full-stack-load.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixture = () => ({
  schemaVersion: 1,
  failedRate: 0,
  checkRate: 1,
  dropped: 0,
  phases: [
    { name: 'baseline', requests: 75, latencyMs: { p50: 2, p95: 4, p99: 8, max: 10 } },
    { name: 'concurrent', requests: 300, latencyMs: { p50: 3, p95: 7, p99: 12, max: 15 } },
  ],
});
test('load result must contain both complete phases and no failures or dropped iterations', () => {
  assert.deepEqual(validateLoadReport(fixture()), fixture());
  const boundary = fixture();
  boundary.phases[0].requests = 76;
  boundary.phases[1].requests = 301;
  assert.deepEqual(validateLoadReport(boundary), boundary);
  for (const invalid of [
    { ...fixture(), failedRate: 0.01 },
    { ...fixture(), checkRate: 0.99 },
    { ...fixture(), dropped: 1 },
    { ...fixture(), phases: fixture().phases.slice(0, 1) },
    { ...fixture(), phases: [{ ...fixture().phases[0], requests: 74 }, fixture().phases[1]] },
    {
      ...fixture(),
      phases: [
        { ...fixture().phases[0], latencyMs: { p50: 2, p95: 4, p99: 1, max: 10 } },
        fixture().phases[1],
      ],
    },
  ])
    assert.throws(() => validateLoadReport(invalid));
});
test('profile has fixed synthetic GET routes, strict TLS, bounded arrival rates and VUs', () => {
  const script = read('ops/performance/full-stack.k6.js');
  const urls = [...script.matchAll(/https:\/\/([^/]+)\//g)].map((m) => m[1]);
  assert.equal(urls.length, 9);
  assert.ok(urls.every((host) => host.endsWith('.rehearsal.invalid')));
  assert.match(script, /insecureSkipTLSVerify: false/);
  assert.match(script, /maxRedirects: 0/);
  assert.match(script, /rate: 5,/);
  assert.match(script, /rate: 20,/);
  assert.match(script, /maxVUs: 1,/);
  assert.match(script, /maxVUs: 4,/);
  assert.match(script, /dropped_iterations: \['count==0'\]/);
  assert.doesNotMatch(script, /__ENV|http\.(post|put|patch|del)\(/);
});
test('runner requires isolated Compose network and explicitly opt-in local load profile', () => {
  const script = read('scripts/full-stack-load.mjs');
  assert.match(script, /network.Internal, true/);
  assert.match(script, /com\.docker\.compose\.project/);
  assert.match(script, /grafana\/k6@sha256:[a-f0-9]{64}/);
  assert.match(script, /SSL_CERT_FILE=\/probe\/ca.crt/);
  assert.match(script, /pg_stat_activity/);
  assert.doesNotMatch(script, /--publish|--privileged|docker\.sock/);
  const edge = read('scripts/full-stack-staging-edge.mjs');
  assert.match(edge, /if \(loadProfile\) await probeFullStackLoad/);
  const runner = read('scripts/full-stack-rehearsal.mjs');
  assert.match(runner, /loadProfile = false/);
  assert.match(runner, /process.argv\[2\] === '--load'/);
  assert.doesNotMatch(read('.github/workflows/ci.yml'), /full-stack-rehearsal\.mjs --load/);
});
