import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const landingBuildEnv = [
  'LANDING_SITE_URL',
  'LANDING_ALLOW_INDEXING',
  'NEXT_PUBLIC_UMAMI_WEBSITE_ID',
  'NEXT_PUBLIC_UMAMI_SCRIPT_URL',
];

test('Turborepo hashes canonical, indexing and analytics environment for Landing builds', () => {
  const turbo = JSON.parse(read('turbo.json'));
  const buildEnv = turbo.tasks.build.env;

  for (const name of landingBuildEnv) {
    assert.ok(buildEnv.includes(name), `${name} must invalidate the build cache`);
  }
  assert.ok(turbo.globalEnv.includes('GYM_API_INTERNAL_URL'));

  const seo = read('apps/landing/src/shared/lib/seo.ts');
  assert.match(seo, /process\.env\.LANDING_SITE_URL/);
});

test('public build inputs do not include credentials or disable test execution', () => {
  const turbo = JSON.parse(read('turbo.json'));
  const buildEnv = turbo.tasks.build.env;

  for (const name of buildEnv) {
    assert.ok(!/(?:SECRET|PASSWORD|TOKEN|API_KEY|SMTP_URL)/.test(name), name);
  }
  assert.equal(turbo.tasks.test.cache, false);
  assert.ok(turbo.tasks.build.outputs.includes('.next/**'));
  assert.ok(turbo.tasks.build.outputs.includes('!.next/cache/**'));
  assert.ok(turbo.tasks.build.outputs.includes('!.next/dev/**'));
  assert.ok(turbo.tasks.build.outputs.includes('dist/**'));
  assert.ok(turbo.tasks.build.outputs.includes('build/**'));
  assert.ok(turbo.tasks.build.outputs.includes('.cache/expo-ios/**'));
  assert.deepEqual(turbo.tasks.build.dependsOn, ['^build']);
});
