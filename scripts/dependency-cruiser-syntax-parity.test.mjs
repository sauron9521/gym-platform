import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

import { checkWorkspaceBoundaries } from './check-workspace-boundaries.mjs';
import { inspectWorkspaceImports } from './dependency-cruiser-workspace-imports.mjs';

function withFixture(files, check) {
  const root = mkdtempSync(join(tmpdir(), 'gym-import-syntax-parity-'));
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
    for (const [file, source] of Object.entries(files)) {
      const full = join(root, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, source);
    }
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('parser and legacy detect unresolved relative imports across common syntax forms', () => {
  const cases = [
    ['static.js', "import { value } from '../../beta/src/missing';\n"],
    ['side-effect.js', "import '../../beta/src/missing';\n"],
    ['reexport.js', "export { value } from '../../beta/src/missing';\n"],
    ['reexport-all.js', "export * from '../../beta/src/missing';\n"],
    ['dynamic.js', "const dependency = import('../../beta/src/missing');\n"],
    ['commonjs.cjs', "const dependency = require('../../beta/src/missing');\n"],
    ['type-only.ts', "import type { Value } from '../../beta/src/missing';\n"],
    ['type-reexport.ts', "export type { Value } from '../../beta/src/missing';\n"],
    ['type-tsx.tsx', "import type { Value } from '../../beta/src/missing';\n"],
  ];
  const files = Object.fromEntries(
    cases.map(([name, source]) => ['apps/alpha/src/' + name, source]),
  );
  withFixture(files, (root) => {
    const legacy = checkWorkspaceBoundaries(root);
    const cruiser = inspectWorkspaceImports(root);
    const suffix = ': cross-workspace relative import ../../beta/src/missing';

    for (const [name] of cases) {
      const expected = 'apps/alpha/src/' + name + suffix;
      assert.ok(
        legacy.some((message) => message.startsWith(expected)),
        name + ': legacy',
      );
      assert.ok(
        cruiser.relative.some((message) => message.startsWith(expected)),
        name + ': graph',
      );
    }
  });
});

test('named app imports remain detectable across JavaScript, TypeScript and CommonJS', () => {
  const cases = [
    ['static.js', "import { value } from '@gym/beta';\n"],
    ['side-effect.js', "import '@gym/beta';\n"],
    ['reexport.js', "export { value } from '@gym/beta';\n"],
    ['reexport-all.js', "export * from '@gym/beta';\n"],
    ['dynamic.js', "const dependency = import('@gym/beta');\n"],
    ['commonjs.cjs', "const dependency = require('@gym/beta');\n"],
    ['type-only.ts', "import type { Value } from '@gym/beta';\n"],
    ['type-reexport.ts', "export type { Value } from '@gym/beta';\n"],
  ];
  const files = Object.fromEntries(
    cases.map(([name, source]) => ['apps/alpha/src/' + name, source]),
  );
  withFixture(files, (root) => {
    const { named } = inspectWorkspaceImports(root);
    for (const [name] of cases) {
      const expected = 'apps/alpha/src/' + name + ': import of application @gym/beta';
      assert.ok(named.includes(expected), name + ': named app graph');
    }
  });
});

test('parser ignores comments and quoted import-like text that fool the legacy scanner', () => {
  withFixture(
    {
      'apps/alpha/src/comment.js': "// import '../../beta/src/missing';\n",
      'apps/alpha/src/string.js': 'const sample = "import \'../../beta/src/missing\'";\n',
    },
    (root) => {
      const legacy = checkWorkspaceBoundaries(root);
      assert.ok(legacy.some((message) => message.startsWith('apps/alpha/src/comment.js:')));
      assert.ok(legacy.some((message) => message.startsWith('apps/alpha/src/string.js:')));
      const graph = inspectWorkspaceImports(root);
      assert.deepEqual(graph.relative, []);
      assert.deepEqual(graph.named, []);
    },
  );
});
