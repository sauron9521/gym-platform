import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/ci.yml');
const integration = read('../.github/workflows/web-integration.yml');
const web = JSON.parse(read('../apps/web/package.json'));
const landing = JSON.parse(read('../apps/landing/package.json'));

const sections = workflow.split('  landing-browser-e2e:\n');
const webSuite = sections[0].split('  web-browser-e2e:\n')[1];
const landingSuite = sections[1].split('  quality-workspaces:\n')[0];
const integrationSuite = integration.split('  browser-api-suite:\n')[1];

test('browser E2E jobs use identical pinned Playwright images', () => {
  assert.ok(webSuite);
  assert.ok(landingSuite);
  assert.ok(integrationSuite);

  const version = web.devDependencies['@playwright/test'];
  assert.equal(landing.devDependencies['@playwright/test'], version);
  assert.match(version, /^\d+\.\d+\.\d+$/);

  const image = integrationSuite.match(/mcr\.microsoft\.com\/playwright:[^\s]+/)?.[0];
  assert.ok(image);
  assert.ok(image.includes('playwright:v' + version + '-noble'));
  assert.match(image, /@sha256:[a-f0-9]{64}$/);

  for (const [label, suite] of [
    ['Web fixture', webSuite],
    ['Landing', landingSuite],
  ]) {
    assert.ok(suite.includes('image: ' + image), label);
    assert.ok(suite.includes('runs-on: ubuntu-24.04'));
    assert.doesNotMatch(suite, /playwright install|ms-playwright/);
    assert.match(suite, /pnpm install --frozen-lockfile/);
  }
});

test('affected checks retain browsers, traces and required gate', () => {
  assert.match(webSuite, /if: needs\.changes\.outputs\.web == 'true'/);
  assert.match(landingSuite, /if: needs\.changes\.outputs\.landing == 'true'/);
  assert.ok(webSuite.includes('pnpm --filter @gym/web exec playwright test'));
  assert.ok(landingSuite.includes('pnpm --filter @gym/landing test:e2e'));
  assert.ok(webSuite.includes('web-playwright-failures'));
  assert.ok(landingSuite.includes('landing-playwright-failures'));
  assert.ok(workflow.includes('name: Quality / Node 24'));
  assert.ok(workflow.includes('name: API e2e / PostgreSQL 17'));
  assert.ok(integration.includes('name: Web / Real API and PostgreSQL\n'));
  assert.ok(workflow.includes('      - web-browser-e2e\n'));
  assert.ok(workflow.includes('      - landing-browser-e2e\n'));
});

test('fixture API E2E splits all specs across isolated required shards', () => {
  assert.match(webSuite, /fail-fast: false/);
  assert.match(webSuite, /shard: \[1, 2\]/);
  assert.ok(webSuite.includes('test --shard=${{ matrix.shard }}/2'));
  assert.ok(webSuite.includes('web-playwright-failures-${{ matrix.shard }}'));
  assert.ok(workflow.includes('WEB_E2E_RESULT: ${{ needs.web-browser-e2e.result }}'));
  assert.ok(workflow.includes('test "$WEB_E2E_RESULT" = success'));
  const config = read('../apps/web/playwright.config.ts');
  assert.match(config, /fullyParallel: false/);
  assert.match(config, /workers: 1/);
});
