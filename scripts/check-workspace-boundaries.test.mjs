import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'vitest';

import { checkWorkspaceBoundaries } from './check-workspace-boundaries.mjs';
import { inspectWorkspaceImports } from './dependency-cruiser-workspace-imports.mjs';

function workspace(root, kind, folder, name, dependencies = {}) {
  const directory = join(root, kind, folder);
  mkdirSync(join(directory, 'src'), { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, dependencies }));
  return directory;
}

function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'gym-boundaries-'));
  try {
    const api = workspace(root, 'apps', 'api', '@gym/api');
    const web = workspace(root, 'apps', 'web', '@gym/web', {
      '@gym/api-client': 'workspace:*',
    });
    const client = workspace(root, 'packages', 'api-client', '@gym/api-client');
    const domain = workspace(root, 'packages', 'domain', '@gym/domain');
    run({ root, api, web, client, domain });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('actual workspace manifests and shared dependency graph stay within boundaries', () => {
  assert.deepEqual(checkWorkspaceBoundaries(fileURLToPath(new URL('../', import.meta.url))), []);
});

test('valid shared-package imports do not trigger false positives', () => {
  withFixture(({ root, web }) => {
    writeFileSync(join(web, 'src', 'index.ts'), "import { api } from '@gym/api-client';\n");
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
  });
});

test('reject direct workspace dependencies on another application', () => {
  withFixture(({ root, web }) => {
    writeFileSync(
      join(web, 'package.json'),
      JSON.stringify({ name: '@gym/web', dependencies: { '@gym/api': 'workspace:*' } }),
    );
    assert.ok(
      checkWorkspaceBoundaries(root).some((message) =>
        message.includes('must not depend on app @gym/api'),
      ),
    );
  });
});

test('required dependency-cruiser graph owns named and relative import protection', () => {
  withFixture(({ root, web }) => {
    writeFileSync(
      join(web, 'src', 'page.ts'),
      "import type { X } from '@gym/api';\nexport * from '../../api/src/secret';\n",
    );
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
    const { named, relative } = inspectWorkspaceImports(root);
    assert.ok(named.some((message) => message.includes('import of application @gym/api')));
    assert.ok(relative.some((message) => message.includes('cross-workspace relative import')));
  });
});

test('reject package-to-app relative imports', () => {
  withFixture(({ root, domain }) => {
    writeFileSync(
      join(domain, 'src', 'index.ts'),
      "const source = import('../../../apps/web/src/index');\n",
    );
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
    assert.ok(
      inspectWorkspaceImports(root).relative.some((message) =>
        message.includes('cross-workspace relative import'),
      ),
    );
  });
});

test('reject shared package dependency cycles', () => {
  withFixture(({ root, client, domain }) => {
    writeFileSync(
      join(client, 'package.json'),
      JSON.stringify({ name: '@gym/api-client', dependencies: { '@gym/domain': 'workspace:*' } }),
    );
    writeFileSync(
      join(domain, 'package.json'),
      JSON.stringify({ name: '@gym/domain', dependencies: { '@gym/api-client': 'workspace:*' } }),
    );
    assert.ok(
      checkWorkspaceBoundaries(root).some((message) =>
        message.includes('Shared package dependency cycle'),
      ),
    );
  });
});

test('tooling workspaces participate in manifest dependency and duplicate-name checks', () => {
  withFixture(({ root }) => {
    const tools = workspace(root, 'tooling', 'checks', '@gym/checks', {
      '@gym/api': 'workspace:*',
    });
    const errors = checkWorkspaceBoundaries(root);
    assert.ok(errors.some((message) => message.includes('must not depend on app @gym/api')));

    writeFileSync(join(tools, 'package.json'), JSON.stringify({ name: '@gym/domain' }));
    assert.ok(
      checkWorkspaceBoundaries(root).some((message) =>
        message.includes('duplicate workspace package name'),
      ),
    );
  });
});

test('tooling packages participate in shared dependency cycle detection', () => {
  withFixture(({ root, domain }) => {
    workspace(root, 'tooling', 'checks', '@gym/checks', { '@gym/domain': 'workspace:*' });
    writeFileSync(
      join(domain, 'package.json'),
      JSON.stringify({ name: '@gym/domain', dependencies: { '@gym/checks': 'workspace:*' } }),
    );
    assert.ok(
      checkWorkspaceBoundaries(root).some((message) =>
        message.includes('Shared package dependency cycle'),
      ),
    );
  });
});

test.each([
  ['app to shared package', 'apps/web', '../../../packages/domain/src/index'],
  ['package to tooling', 'packages/domain', '../../../tooling/checks/src/index'],
  ['tooling to package', 'tooling/checks', '../../../packages/domain/src/index'],
  ['tooling to app', 'tooling/checks', '../../../apps/web/src/index'],
])('reject cross-workspace relative import: %s', (_name, source, imported) => {
  withFixture(({ root }) => {
    workspace(root, 'tooling', 'checks', '@gym/checks');
    writeFileSync(join(root, source, 'src', 'index.ts'), "import '" + imported + "';\n");
    assert.deepEqual(checkWorkspaceBoundaries(root), []);
    assert.ok(
      inspectWorkspaceImports(root).relative.some((message) =>
        message.includes('cross-workspace relative import'),
      ),
    );
  });
});
