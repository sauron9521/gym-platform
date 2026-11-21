import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('withdrawn picomatch advisory is no longer silently excluded by pnpm', () => {
  const workspace = read('../pnpm-workspace.yaml');
  assert.doesNotMatch(workspace, /^\s*-\s*GHSA-fc5q-39xc-vjpf\s*$/m);
  assert.doesNotMatch(workspace, /^audit:\s*\n\s+ignore:/m);
});

test('CI and scheduled dependency audits still block high production and critical findings', () => {
  for (const workflow of [
    '../.github/workflows/ci.yml',
    '../.github/workflows/dependency-audit.yml',
  ]) {
    const yaml = read(workflow);
    assert.match(yaml, /pnpm audit --prod --audit-level high/);
    assert.match(yaml, /pnpm audit --audit-level critical/);
  }
});
