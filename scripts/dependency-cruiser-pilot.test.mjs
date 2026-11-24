import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = resolve(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const config = resolve(root, '.dependency-cruiser.cjs');

function cruise(files) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'gym-depcruise-'));
  try {
    mkdirSync(join(temporaryRoot, 'apps'));
    mkdirSync(join(temporaryRoot, 'packages'));
    for (const [path, content] of Object.entries(files)) {
      const destination = join(temporaryRoot, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content, 'utf8');
    }
    return spawnSync(
      process.execPath,
      [bin, '--config', config, '--output-type', 'err', 'apps', 'packages'],
      { cwd: temporaryRoot, encoding: 'utf8', timeout: 20_000 },
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test('dependency-cruiser accepts same-workspace imports', () => {
  const result = cruise({
    'apps/alpha/src/index.js': "import './same.js';",
    'apps/alpha/src/same.js': 'export const value = 1;',
    'packages/shared/src/index.js': "import './same.js';",
    'packages/shared/src/same.js': 'export const value = 2;',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test.each([
  [
    'cross-application imports',
    {
      'apps/alpha/src/index.js': "import '../../beta/src/index.js';",
      'apps/beta/src/index.js': 'export const value = 1;',
    },
    'no-cross-app-source-imports',
  ],
  [
    'shared package imports from an application',
    {
      'packages/shared/src/index.js': "import '../../../apps/alpha/src/index.js';",
      'apps/alpha/src/index.js': 'export const value = 1;',
    },
    'no-app-source-in-shared-packages',
  ],
  [
    'relative imports between shared packages',
    {
      'packages/one/src/index.js': "import '../../two/src/index.js';",
      'packages/two/src/index.js': 'export const value = 1;',
    },
    'no-relative-cross-workspace-source-imports',
  ],
  [
    'relative imports between API features',
    {
      'apps/api/src/modules/users/index.js': "import '../workouts/index.js';",
      'apps/api/src/modules/workouts/index.js': 'export const value = 1;',
    },
    'no-relative-cross-feature-api-imports',
  ],
])('dependency-cruiser rejects %s', (_description, files, rule) => {
  const result = cruise(files);
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, new RegExp(rule));
});

test('dependency-cruiser pilot does not bypass existing API guards', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(pkg.devDependencies['dependency-cruiser'], '18.9.0');
  assert.match(pkg.scripts['architecture:cruise'], /--config \.dependency-cruiser\.cjs/);
  assert.match(ci, /architecture:check/);
  assert.match(ci, /architecture:deps/);
  const diagnosticWorkflow = readFileSync(
    new URL('../.github/workflows/tooling-audit.yml', import.meta.url),
    'utf8',
  );
  assert.match(diagnosticWorkflow, /^  workflow_dispatch:$/m);
  assert.match(diagnosticWorkflow, /pnpm architecture:cruise:boundaries/);
  assert.doesNotMatch(diagnosticWorkflow, /pnpm architecture:cruise(?:\s|$)/m);
  assert.match(diagnosticWorkflow, /architecture-workspace-imports\.txt/);
  assert.doesNotMatch(diagnosticWorkflow, /architecture-cruise\.txt/);
});
