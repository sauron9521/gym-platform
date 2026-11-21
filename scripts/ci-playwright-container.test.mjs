import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/web-integration.yml');
const config = read('../apps/web/playwright.integration.config.ts');
const web = JSON.parse(read('../apps/web/package.json'));
const matrix = workflow.split('  browser-api-suite:\n')[1];
const suite = matrix?.split('\n  browser-api:\n')[0];

test('pins CI image to the Playwright test dependency version', () => {
  assert.ok(suite, 'Integration matrix must exist');
  const version = web.devDependencies['@playwright/test'];
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const tag = 'playwright:v' + version + '-noble@sha256:';
  assert.ok(suite.includes('image: mcr.microsoft.com/' + tag));
  assert.ok(workflow.startsWith('name: Web / Integration E2E\n'));
  assert.match(suite, /runs-on: ubuntu-24\.04/);
  assert.match(suite, /shard: \[1, 2, 3, 4\]/);
  assert.match(suite, /fail-fast: false/);
  assert.doesNotMatch(suite, /playwright install|actions\/cache@v6/);
  assert.ok(workflow.includes('name: Web / Real API and PostgreSQL\n'));
});

test('uses a disposable PostgreSQL service without a host port', () => {
  assert.ok(suite);
  const db = 'postgresql://postgres:postgres@postgres:5432/gym_browser_test';
  assert.match(suite, /image: postgres:17-alpine/);
  assert.doesNotMatch(suite, /ports:\s*\['5432:5432'\]/);
  assert.ok(suite.includes('DATABASE_URL: ' + db));
  assert.ok(suite.includes('TEST_DATABASE_URL: ' + db));
  assert.ok(suite.includes('url.hostname !== "postgres"'));
  assert.ok(suite.includes('url.port !== "5432"'));
  assert.ok(suite.includes('!== "/gym_browser_test"'));
});

test('requires CI for the explicit disposable service database', () => {
  assert.match(config, /database !== process\.env\.DATABASE_URL/);
  assert.match(config, /process\.env\.CI === 'true'/);
  assert.match(config, /url\.hostname === 'postgres'/);
  assert.match(config, /databaseName === '\/gym_browser_test'/);
  assert.match(config, /!localTestDatabase && !ciServiceDatabase/);
});

test('E2E role fixtures enforce the same disposable DB restriction', () => {
  const fixtures = read('../apps/web/e2e/support/real-api-accounts.ts');
  assert.match(fixtures, /database !== process\.env\.DATABASE_URL/);
  assert.match(fixtures, /process\.env\.CI === 'true'/);
  assert.match(fixtures, /url\.hostname === 'postgres'/);
  assert.match(fixtures, /databaseName === '\/gym_browser_test'/);
  assert.match(fixtures, /!localTestDatabase && !ciServiceDatabase/);
});
