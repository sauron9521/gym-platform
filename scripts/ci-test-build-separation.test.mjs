import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('Landing and Admin builds compile without implicitly running unit tests', () => {
  for (const app of ['landing', 'admin']) {
    const manifest = JSON.parse(
      readFileSync(new URL(`../apps/${app}/package.json`, import.meta.url), 'utf8'),
    );
    assert.equal(manifest.scripts.build, 'next build');
    assert.match(manifest.scripts.test, /test:contracts/);
    assert.match(manifest.scripts.test, /test:components/);
  }
});

test('CI explicitly runs Landing and Admin unit tests in full and affected scopes', () => {
  const start = workflow.indexOf('  quality-workspaces:\n');
  const end = workflow.indexOf('\n  quality:\n', start);
  assert.ok(start >= 0 && end > start, 'Quality workspaces job must exist');
  const quality = workflow.slice(start, end);
  const fullMarker = '      - name: Full workspace regression';
  const affectedMarker = '      - name: Lint, typecheck, test and build affected workspaces';
  const fullStart = quality.indexOf(fullMarker);
  const affectedStart = quality.indexOf(affectedMarker);
  assert.ok(fullStart >= 0 && affectedStart > fullStart, 'CI test steps must exist');
  const full = quality.slice(fullStart, affectedStart);
  const affected = quality.slice(affectedStart);

  assert.match(full, /--filter=@gym\/landing --filter=@gym\/admin/);
  assert.ok(affected.includes('test_filters+=(--filter=@gym/landing)'));
  assert.ok(affected.includes('test_filters+=(--filter=@gym/admin)'));
  assert.ok(affected.includes('pnpm exec turbo run test "${test_filters[@]}"'));
});
