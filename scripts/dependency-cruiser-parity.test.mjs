import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

import { checkWorkspaceBoundaries } from './check-workspace-boundaries.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cruiserBin = resolve(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const cruiserConfig = resolve(root, '.dependency-cruiser.cjs');

function withWorkspaceFixture(imports, check) {
  const directory = mkdtempSync(join(tmpdir(), 'gym-workspace-parity-'));
  try {
    for (const [folder, name] of [
      ['apps/alpha', '@gym/alpha'],
      ['apps/beta', '@gym/beta'],
      ['packages/shared', '@gym/shared'],
      ['tooling/checks', '@gym/checks'],
    ]) {
      mkdirSync(join(directory, folder, 'src'), { recursive: true });
      writeFileSync(join(directory, folder, 'package.json'), JSON.stringify({ name }));
      writeFileSync(join(directory, folder, 'src', 'index.js'), 'export const ready = true;\n');
    }
    for (const [path, source] of Object.entries(imports)) {
      const fullPath = join(directory, path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, source);
    }

    const custom = checkWorkspaceBoundaries(directory);
    const cruiser = spawnSync(
      process.execPath,
      [cruiserBin, '--config', cruiserConfig, '--output-type', 'err', 'apps', 'packages', 'tooling'],
      { cwd: directory, encoding: 'utf8', timeout: 20_000 },
    );
    assert.ifError(cruiser.error);
    check(custom, cruiser);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('same-workspace imports are accepted by both architecture checkers', () => {
  withWorkspaceFixture(
    {
      'apps/alpha/src/index.js': "import './local.js';\n",
      'apps/alpha/src/local.js': 'export const value = 1;\n',
    },
    (custom, cruiser) => {
      assert.deepEqual(custom, []);
      assert.equal(cruiser.status, 0, cruiser.stdout + cruiser.stderr);
    },
  );
});

test.each([
  [
    'app to app',
    'apps/alpha/src/index.js',
    "import '../../beta/src/index.js';",
    'no-cross-app-source-imports',
  ],
  [
    'app to shared package',
    'apps/alpha/src/index.js',
    "import '../../../packages/shared/src/index.js';",
    'no-relative-cross-workspace-source-imports',
  ],
  [
    'package to app',
    'packages/shared/src/index.js',
    "import '../../../apps/alpha/src/index.js';",
    'no-app-source-in-shared-packages',
  ],
  [
    'package to tooling',
    'packages/shared/src/index.js',
    "import '../../../tooling/checks/src/index.js';",
    'no-relative-cross-workspace-source-imports',
  ],
  [
    'tooling to package',
    'tooling/checks/src/index.js',
    "import '../../../packages/shared/src/index.js';",
    'no-relative-cross-workspace-source-imports',
  ],
  [
    'tooling to app',
    'tooling/checks/src/index.js',
    "import '../../../apps/alpha/src/index.js';",
    'no-app-source-in-shared-packages',
  ],
])('both checkers reject illegal cross-workspace source imports: %s', (_name, source, importLine, rule) => {
  withWorkspaceFixture(
    { [source]: importLine + '\n' },
    (custom, cruiser) => {
      assert.ok(
        custom.some((message) => message.includes('cross-workspace relative import')),
        custom.join('\n'),
      );
      assert.notEqual(cruiser.status, 0, cruiser.stdout + cruiser.stderr);
      assert.match(cruiser.stdout + cruiser.stderr, new RegExp(rule));
    },
  );
});
