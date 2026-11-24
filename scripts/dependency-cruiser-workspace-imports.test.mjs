import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

import { inspectWorkspaceImports } from './dependency-cruiser-workspace-imports.mjs';

function withFixture(files, check) {
  const root = mkdtempSync(join(tmpdir(), 'gym-combined-cruiser-'));
  try {
    for (const [directory, name] of [
      ['apps/alpha', '@gym/alpha'],
      ['apps/beta', '@gym/beta'],
      ['packages/shared', '@gym/shared'],
      ['tooling/checks', '@gym/checks'],
    ]) {
      mkdirSync(join(root, directory, 'src'), { recursive: true });
      writeFileSync(join(root, directory, 'package.json'), JSON.stringify({ name }));
      writeFileSync(join(root, directory, 'src', 'index.js'), 'export const ok = true;\n');
    }
    for (const [file, contents] of Object.entries(files)) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('one graph catches named app imports and unresolved cross-workspace relative imports', () => {
  withFixture(
    {
      'apps/alpha/src/index.ts':
        "import type { Example } from '@gym/beta';\n" +
        "export * from '../../beta/src/missing.ts';\n",
    },
    (root) => {
      const { named, relative } = inspectWorkspaceImports(root);
      assert.deepEqual(named, ['apps/alpha/src/index.ts: import of application @gym/beta']);
      assert.deepEqual(relative, [
        'apps/alpha/src/index.ts: cross-workspace relative import ../../beta/src/missing.ts (use public package exports)',
      ]);
    },
  );
});

test('test-source imports are included in both required graph checks', () => {
  withFixture(
    {
      'apps/alpha/src/tests/workspace.spec.ts':
        "import type { Example } from '@gym/beta';\n" +
        "export * from '../../../beta/src/missing.ts';\n",
    },
    (root) => {
      const { named, relative } = inspectWorkspaceImports(root);
      assert.deepEqual(named, [
        'apps/alpha/src/tests/workspace.spec.ts: import of application @gym/beta',
      ]);
      assert.deepEqual(relative, [
        'apps/alpha/src/tests/workspace.spec.ts: cross-workspace relative import ../../../beta/src/missing.ts (use public package exports)',
      ]);
    },
  );
});

test('one parsed graph ignores import-like text and permits public shared-package imports', () => {
  withFixture(
    {
      'apps/alpha/src/index.js':
        'const text = "import \'../../beta/src/hidden.js\'";\n' +
        "import './local.js';\nimport '@gym/shared';\n",
      'apps/alpha/src/local.js': 'export const local = true;\n',
    },
    (root) => {
      const { named, relative, graphErrors } = inspectWorkspaceImports(root);
      assert.deepEqual(named, []);
      assert.deepEqual(relative, []);
      assert.equal(graphErrors, 0);
    },
  );
});

test('nonexistent apps root fails closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'gym-combined-invalid-'));
  try {
    assert.throws(() => inspectWorkspaceImports(root), /Missing apps workspace directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
