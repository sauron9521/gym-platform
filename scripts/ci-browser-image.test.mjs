import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/ci.yml');
const integration = read('../.github/workflows/web-integration.yml');
const web = JSON.parse(read('../apps/web/package.json'));
const landing = JSON.parse(read('../apps/landing/package.json'));

const fixture = workflow
  .split('  web-browser-e2e:\n')[1]
  ?.split('\n  landing-browser-e2e:\n')[0];
const landingSuite = workflow
  .split('  landing-browser-e2e:\n')[1]
  ?.split('\n  quality-workspaces:\n')[0];
const integrationSuite = integration
  .split('  browser-api-suite:\n')[1]
  ?.split('\n  browser-api:\n')[0];

test('browser E2E jobs use identical pinned Playwright images', () => {
  assert.ok(fixture, 'Web fixture E2E job missing');
  assert.ok(landingSuite, 'Landing E2E job missing');
  assert.ok(integrationSuite, 'Web integration E2E matrix missing');

  const version = web.devDependencies['@playwright/test'];
  assert.equal(landing.devDependencies['@playwright/test'], version);
  assert.match(version, /^\d+\.\d+\.\d+$/);

  const image = integrationSuite.match(
    /mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble@sha256:[a-f0-9]{64}/,
  )?.[0];
  assert.ok(image, 'Reference Playwright image must be pinned by digest');
  assert.ok(image.includes('playwright:v' + version + '-noble'));

  for (const [name, suite] of [
    ['Web fixture', fixture],
    ['Landing', landingSuite],
  ]) {
    assert.ok(suite.includes('image: ' + image), name + ' must match image');
    assert.ok(suite.includes('runs-on: ubuntu-24.04'));
    assert.doesNotMatch(suite, /playwright install|ms-playwright|actions\/cache@v6/);
    assert.match(suite, /pnpm install --frozen-lockfile/);
  }
});

test('browser jobs retain affected scope, E2E, traces and required gate', () => {
  assert.ok(fixture);
  assert.ok(landingSuite);
  assert.ok(fixture.includes("if: needs.changes.outputs.web == 'true'"));
  assert.ok(landingSuite.includes("if: needs.changes.outputs.landing == 'true'"));
  assert.ok(fixture.includes('pnpm --filter @gym/web test:e2e'));
  assert.ok(landingSuite.includes('pnpm --filter @gym/landing test:e2e'));
  assert.ok(fixture.includes('web-playwright-failures'));
  assert.ok(landingSuite.includes('landing-playwright-failures'));
  assert.ok(workflow.includes('name: Quality / Node 24'));
  assert.ok(workflow.includes('name: API e2e / PostgreSQL 17'));
  assert.ok(integration.includes('name: Web / Real API and PostgreSQL\n'));
  assert.ok(workflow.includes('      - web-browser-e2e\n'));
  assert.ok(workflow.includes('      - landing-browser-e2e\n'));
});
