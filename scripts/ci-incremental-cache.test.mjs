import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const quality = yaml.split('  quality-workspaces:\n')[1]?.split('\n  quality:\n')[0];
const cache = quality
  ?.split('      - name: Restore Turborepo and Next.js incremental build caches\n')[1]
  ?.split('      - name: Install dependencies\n')[0];

test('restore keys prefer matching graph, then reuse older compatible caches', () => {
  assert.ok(cache, 'Quality cache step not found');
  const restoreKeys = cache
    .split('          restore-keys: |\n')[1]
    ?.split('      - name: Report incremental build cache restore\n')[0]
    .split('\n')
    .filter((line) => line.startsWith('            '))
    .map((line) => line.trim());
  assert.equal(restoreKeys?.length, 2);
  assert.match(restoreKeys[0], /node24-build-.*hashFiles\(/);
  assert.match(restoreKeys[0], /turbo\.json/);
  assert.match(restoreKeys[0], /package\.json/);
  assert.equal(restoreKeys[1], '${{ runner.os }}-node24-build-');
  assert.match(cache, /key: .*node24-build-.*github\.sha/);
});

test('only build artifacts are cached, including all Next applications', () => {
  assert.ok(cache);
  const paths = cache.split('          path: |\n')[1]?.split('\n          key: ')[0];
  assert.ok(paths);
  for (const entry of [
    '.turbo/cache',
    'apps/web/.next/cache',
    'apps/landing/.next/cache',
    'apps/admin/.next/cache',
    'apps/trainer/.next/cache',
  ]) {
    assert.ok(paths.includes(entry), entry);
  }
  assert.doesNotMatch(paths, /node_modules|\.env|secret|password/i);
  assert.match(quality, /name: Quality workspaces \/ Node 24/);
});

test('cache logs distinguish exact, partial and cold restores', () => {
  assert.ok(cache);
  assert.match(cache, /id: incremental-build-cache/);
  assert.ok(cache.includes('steps.incremental-build-cache.outputs.cache-hit'));
  for (const expected of [
    'Exact incremental build cache hit',
    'Restored a prior incremental build cache',
    'No compatible incremental build cache found',
  ]) {
    assert.ok(cache.includes(expected), expected);
  }
  assert.match(quality, /pnpm format:check/);
  assert.match(quality, /pnpm typecheck/);
  assert.match(quality, /pnpm build/);
  assert.match(yaml, /name: Quality \/ Node 24/);
  assert.match(yaml, /name: API e2e \/ PostgreSQL 17/);
});
