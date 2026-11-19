import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/web-integration.yml', import.meta.url), 'utf8');
const config = readFileSync(new URL('../apps/web/playwright.integration.config.ts', import.meta.url), 'utf8');
const web = JSON.parse(readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
const suite = workflow.split('  browser-api-suite:\n')[1]?.split('\n  browser-api:\n')[0];

test('real API E2E shards use a version-matched, immutable official Playwright image', () => {
  assert.ok(suite, 'Integration matrix must exist');
  const version = web.devDependencies['@playwright/test'];
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(workflow.startsWith('name: Web / Integration E2E\n'));
  assert.ok(
    suite.includes('image: mcr.microsoft.com/playwright:v' + version + '-noble@sha256:'),
    'Playwright image tag must match the locked @playwright/test version',
  );
  assert.match(suite, /runs-on: ubuntu-24\.04/);
  assert.match(suite, /shard: \[1, 2, 3, 4\]/);
  assert.match(suite, /fail-fast: false/);
  assert.doesNotMatch(suite, /playwright install|actions\/cache@v6/);
  assert.ok(workflow.includes('name: Web / Real API and PostgreSQL\n'));
});

test('container PostgreSQL uses service DNS without exposing a host port', () => {
  assert.ok(suite);
  assert.match(suite, /image: postgres:17-alpine/);
  assert.doesNotMatch(suite, /ports:\s*\['5432:5432'\]/);
  assert.match(suite, /DATABASE_URL: postgresql:\/\/postgres:postgres@postgres:5432\/gym_browser_test/);
  assert.match(suite, /TEST_DATABASE_URL: postgresql:\/\/postgres:postgres@postgres:5432\/gym_browser_test/);
  assert.match(suite, /url\.hostname !== "postgres"/);
  assert.match(suite, /url\.port !== "5432"/);
  assert.match(suite, /decodeURIComponent\(url\.pathname\) !== "\/gym_browser_test"/);
});

test('browser integration config requires an explicit CI-only disposable service DB', () => {
  assert.match(config, /database !== process\.env\.DATABASE_URL/);
  assert.match(config, /process\.env\.CI === 'true'/);
  assert.match(config, /url\.hostname === 'postgres'/);
  assert.match(config, /databaseName === '\/gym_browser_test'/);
  assert.match(config, /!localTestDatabase && !ciServiceDatabase/);
});
