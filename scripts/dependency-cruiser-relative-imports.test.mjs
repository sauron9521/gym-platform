import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

import { checkWorkspaceBoundaries } from './check-workspace-boundaries.mjs';
import {
  discoverWorkspaceRoots,
  findRelativeWorkspaceImports,
  inspectRelativeWorkspaceImports,
} from './dependency-cruiser-relative-imports.mjs';

function withFixture(files, check) {
  const root = mkdtempSync(join(tmpdir(), 'gym-relative-parity-'));
  try {
    for (const [directory, name] of [
      ['apps/alpha', '@gym/alpha'],
      ['apps/beta', '@gym/beta'],
      ['packages/shared', '@gym/shared'],
      ['tooling/checks', '@gym/checks'],
    ]) {
      mkdirSync(join(root, directory, 'src'), { recursive: true });
      writeFileSync(join(root, directory, 'package.json'), JSON.stringify({ name }));
      writeFileSync(join(root, directory, 'src', 'index.js'), 'export const ready = true;\n');
    }
    for (const [path, content] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    check(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test('workspace roots come from real manifests across apps, packages and tooling', () => {
  withFixture({}, (root) => {
    assert.deepEqual(discoverWorkspaceRoots(root), [
      'apps/alpha',
      'apps/beta',
      'packages/shared',
      'tooling/checks',
    ]);
  });
});

test('relative graph classifier detects missing targets using import specifiers', () => {
  const graph = {
    modules: [
      {
        source: 'apps/alpha/src/index.ts',
        dependencies: [
          { module: '../../beta/src/missing.ts' },
          { module: '../../../packages/shared/src/missing.ts', couldNotResolve: true },
          { module: '../../../tooling/checks/src/missing.ts' },
          { module: './same.ts' },
          { module: '@gym/shared' },
        ],
      },
      {
        source: 'packages/shared/src/index.ts',
        dependencies: [{ module: '../../../apps/beta/src/missing.ts' }],
      },
    ],
  };

  assert.deepEqual(
    findRelativeWorkspaceImports(graph, [
      'apps/alpha',
      'apps/beta',
      'packages/shared',
      'tooling/checks',
    ]),
    [
      'apps/alpha/src/index.ts: cross-workspace relative import ../../beta/src/missing.ts (use public package exports)',
      'apps/alpha/src/index.ts: cross-workspace relative import ../../../packages/shared/src/missing.ts (use public package exports)',
      'apps/alpha/src/index.ts: cross-workspace relative import ../../../tooling/checks/src/missing.ts (use public package exports)',
      'packages/shared/src/index.ts: cross-workspace relative import ../../../apps/beta/src/missing.ts (use public package exports)',
    ].sort(),
  );
});

test('invalid graph fails closed', () => {
  assert.throws(() => findRelativeWorkspaceImports({}, []), /Invalid/);
  assert.throws(() => findRelativeWorkspaceImports({ modules: [] }, ['']), /Invalid/);
  assert.throws(
    () =>
      findRelativeWorkspaceImports({ modules: [{ source: 'apps/alpha/src/index.ts' }] }, [
        'apps/alpha',
      ]),
    /Invalid dependency list/,
  );
});

test.each([
  ['app to app (unresolved)', 'apps/alpha/src/index.js', "import '../../beta/src/missing.js';\n"],
  [
    'app to package (unresolved)',
    'apps/alpha/src/index.js',
    "export * from '../../../packages/shared/src/missing.js';\n",
  ],
  [
    'package to tooling (unresolved)',
    'packages/shared/src/index.js',
    "import '../../../tooling/checks/src/missing.js';\n",
  ],
  [
    'tooling to app (unresolved)',
    'tooling/checks/src/index.js',
    "const result = import('../../../apps/beta/src/missing.js');\n",
  ],
])('required graph catches unresolved relative imports for %s', (_name, file, source) => {
  withFixture({ [file]: source }, (root) => {
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
    const cruiser = inspectRelativeWorkspaceImports(root);
    assert.ok(cruiser.violations.length, 'Missing unresolved edge in dependency-cruiser');
    assert.equal(cruiser.graphErrors >= 0, true);
  });
});

test('valid local and public-package imports are accepted by both checkers', () => {
  withFixture(
    {
      'apps/alpha/src/index.js': "import './local.js';\nimport '@gym/shared';\n",
      'apps/alpha/src/local.js': 'export const ok = true;\n',
    },
    (root) => {
      assert.deepEqual(checkWorkspaceBoundaries(root), []);
      assert.deepEqual(inspectRelativeWorkspaceImports(root).violations, []);
    },
  );
});

test('parsed import graph ignores import-like text without regex false positives', () => {
  withFixture(
    {
      'apps/alpha/src/index.js': 'const example = "import \'../../beta/src/missing.js\'";\n',
    },
    (root) => {
      assert.deepEqual(checkWorkspaceBoundaries(root), []);
      assert.deepEqual(inspectRelativeWorkspaceImports(root).violations, []);
    },
  );
});

test.each([
  ['spec file', 'apps/alpha/src/feature.spec.ts', "import '../../beta/src/missing.ts';\n"],
  ['test file', 'apps/alpha/src/feature.test.ts', "export * from '../../beta/src/missing';\n"],
  ['test directory', 'apps/alpha/src/test/case.ts', "import '../../../beta/src/missing.ts';\n"],
  [
    'tests directory',
    'apps/alpha/src/tests/case.ts',
    "import type { Example } from '../../../beta/src/missing';\n",
  ],
  [
    'e2e directory',
    'apps/alpha/src/e2e/case.ts',
    "const item = import('../../../beta/src/missing.ts');\n",
  ],
])('parsed cruiser graph protects relative imports in %s', (_name, file, source) => {
  withFixture({ [file]: source }, (root) => {
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
    const graph = inspectRelativeWorkspaceImports(root);
    const expected = file + ': cross-workspace relative import ';
    assert.ok(graph.violations.some((message) => message.startsWith(expected)));
  });
});

test('manual audit runs one graph scan and retains standalone commands', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(
    new URL('../.github/workflows/tooling-audit.yml', import.meta.url),
    'utf8',
  );
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(pkg.scripts['architecture:cruise:relative'], /dependency-cruiser-relative-imports/);
  assert.match(workflow, /pnpm architecture:cruise:boundaries/);
  assert.doesNotMatch(workflow, /pnpm architecture:cruise(?:\s|$)/m);
  assert.doesNotMatch(workflow, /pnpm architecture:cruise:named/);
  assert.doesNotMatch(workflow, /pnpm architecture:cruise:relative/);
  assert.match(workflow, /architecture-workspace-imports\.txt/);
  assert.doesNotMatch(workflow, /architecture-cruise\.txt/);
  assert.doesNotMatch(workflow, /architecture-(?:named|relative)-imports\.txt/);
  assert.equal((workflow.match(/pnpm architecture:cruise:boundaries/g) ?? []).length, 1);
  assert.match(ci, /pnpm architecture:cruise:boundaries/);
  assert.match(ci, /pnpm test:tooling/);
  assert.doesNotMatch(ci, /run: pnpm architecture:cruise:relative/);
  assert.match(
    pkg.scripts['architecture:cruise:boundaries'],
    /dependency-cruiser-workspace-imports/,
  );
});
