import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('Turborepo hashes the landing canonical origin at build time', () => {
  const turbo = JSON.parse(read('turbo.json'));
  assert.ok(turbo.tasks.build.env.includes('LANDING_SITE_URL'));
  assert.ok(turbo.globalEnv.includes('GYM_API_INTERNAL_URL'));
  const seo = read('apps/landing/src/shared/lib/seo.ts');
  assert.match(seo, /process\.env\.LANDING_SITE_URL/);
});

test('release-time environment changes invalidate build, never the test cache', () => {
  const turbo = JSON.parse(read('turbo.json'));
  assert.equal(turbo.tasks.test.cache, false);
  assert.ok(turbo.tasks.build.outputs.includes('.next/**'));
});
