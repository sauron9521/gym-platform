import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

import {
  applicationPackageNames,
  findNamedApplicationImports,
  inspectNamedApplicationImports,
} from './dependency-cruiser-named-imports.mjs';

function withFixture(sources, run) {
  const root = mkdtempSync(join(tmpdir(), 'gym-named-app-import-'));
  try {
    for (const [path, name] of [
      ['apps/alpha', '@gym/alpha'],
      ['apps/beta', '@gym/beta'],
      ['packages/shared', '@gym/shared'],
      ['tooling/checks', '@gym/checks'],
    ]) {
      mkdirSync(join(root, path, 'src'), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify({ name }));
      writeFileSync(join(root, path, 'src', 'index.js'), 'export const value = 1;\n');
    }
    for (const [file, content] of Object.entries(sources)) {
      const full = join(root, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('manifest discovery only considers application workspace package names', () => {
  withFixture({}, (root) => {
    assert.deepEqual([...applicationPackageNames(root)].sort(), ['@gym/alpha', '@gym/beta']);
  });
});

test('JSON graph rejects exact named application imports including type-only imports', () => {
  const graph = {
    modules: [
      {
        source: 'apps/alpha/src/index.ts',
        dependencies: [
          { module: '@gym/beta', dependencyTypes: ['type-only', 'import'] },
          { module: '@gym/shared', dependencyTypes: ['npm', 'import'] },
          { module: '@gym/beta/private', dependencyTypes: ['unknown'] },
        ],
      },
      {
        source: 'packages/shared/src/index.ts',
        dependencies: [{ module: '@gym/alpha' }],
      },
      {
        source: 'scripts/not-source.mjs',
        dependencies: [{ module: '@gym/beta' }],
      },
    ],
  };
  assert.deepEqual(findNamedApplicationImports(graph, new Set(['@gym/alpha', '@gym/beta'])), [
    'apps/alpha/src/index.ts: import of application @gym/beta',
    'packages/shared/src/index.ts: import of application @gym/alpha',
  ]);
});

test('malformed graph fails closed instead of silently accepting imports', () => {
  assert.throws(() => findNamedApplicationImports({}, new Set()), /Invalid/);
  assert.throws(
    () => findNamedApplicationImports({ modules: [{ source: 'apps/a/src/index.ts' }] }, new Set()),
    /Invalid dependency list/,
  );
});

test('real dependency-cruiser graph retains unresolved named app imports', () => {
  withFixture(
    {
      'apps/alpha/src/index.js': "import '@gym/beta';\n",
      'packages/shared/src/index.js': "export * from '@gym/alpha';\n",
    },
    (root) => {
      const result = inspectNamedApplicationImports(root);
      assert.deepEqual(result.violations, [
        'apps/alpha/src/index.js: import of application @gym/beta',
        'packages/shared/src/index.js: import of application @gym/alpha',
      ]);
    },
  );
});

test('dependency-cruiser ignores import-like text and allows named shared packages', () => {
  withFixture(
    {
      'apps/alpha/src/index.js': 'const example = "import \'@gym/beta\'";\nimport "@gym/shared";\n',
    },
    (root) => {
      const result = inspectNamedApplicationImports(root);
      assert.deepEqual(result.violations, []);
    },
  );
});

test('required CI tooling gate enforces named application imports from parsed graph', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const tooling = ci.split('  tooling-contracts:\n')[1]?.split('\n  prepush-windows:')[0];
  assert.ok(tooling, 'Required tooling contracts job missing');
  assert.match(tooling, /run: pnpm architecture:cruise:named/);
  assert.match(ci, /tooling-contracts/);
});
