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
  [
    'business modules importing API interfaces',
    {
      'apps/api/src/modules/users/users.module.js': "import '../../api/admin/users.js';",
      'apps/api/src/api/admin/users.js': 'export const value = 1;',
    },
    'no-inward-to-api-interface-imports',
  ],
  [
    'cross-audience API imports',
    {
      'apps/api/src/api/admin/users.js': "import '../shared/users.js';",
      'apps/api/src/api/shared/users.js': 'export const value = 1;',
    },
    'no-cross-audience-api-imports',
  ],
  [
    'API interfaces importing private repositories',
    {
      'apps/api/src/api/admin/users.js': "import '../../modules/users/repositories/users.js';",
      'apps/api/src/modules/users/repositories/users.js': 'export const value = 1;',
    },
    'no-api-interface-private-feature-imports',
  ],
  [
    'API interfaces importing database infrastructure',
    {
      'apps/api/src/api/admin/users.js': "import '../../infra/database/prisma.js';",
      'apps/api/src/infra/database/prisma.js': 'export const value = 1;',
    },
    'no-api-interface-database-imports',
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

test('dependency-cruiser accepts root composition and public feature contracts', () => {
  const result = cruise({
    'apps/api/src/api/api.module.js': "import './admin/users.js';",
    'apps/api/src/api/admin/users.js': [
      "import '../../modules/users/users.module.js';",
      "import '../../modules/users/public-api.js';",
    ].join('\n'),
    'apps/api/src/modules/users/users.module.js': 'export const value = 1;',
    'apps/api/src/modules/users/public-api.js': 'export const value = 2;',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('datetime owner may import date-fns and other workspaces may use its public API', () => {
  const result = cruise({
    'packages/datetime/src/index.js':
      "import { addDays } from 'date-fns/addDays'; export { addDays };",
    'apps/web/src/index.js': "import { addDays } from '@gym/datetime';",
    'apps/web/src/native.js': 'export const now = new Date();',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('datetime ownership rejects direct literal imports, reexports and dynamic imports of date libraries', () => {
  const result = cruise({
    'apps/web/src/index.js': "import { addDays } from 'date-fns/addDays';",
    'apps/mobile/app/index.js': "import { TZDate } from '@date-fns/tz';",
    'apps/api/src/test.ts': "export type { DateTime } from 'luxon';",
    'apps/trainer/test/date.test.js': "const lib = import('dayjs');",
    'apps/admin/src/date.js': "const lib = require('moment-timezone');",
    'packages/domain/src/index.js': "import { Temporal } from '@js-temporal/polyfill';",
    'packages/shared/src/date.js': "import 'date-fns-tz';",
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  for (const source of [
    'apps/web/src/index.js',
    'apps/mobile/app/index.js',
    'apps/api/src/test.ts',
    'apps/trainer/test/date.test.js',
    'apps/admin/src/date.js',
    'packages/domain/src/index.js',
    'packages/shared/src/date.js',
  ]) {
    assert.ok(result.stdout.includes(source), result.stdout + result.stderr);
  }
  assert.match(result.stdout, /datetime-library-owner/);
});

test('datetime ownership also rejects installed direct library imports', () => {
  const result = cruise({
    'apps/web/src/index.js': "import { addDays } from 'date-fns/addDays';",
    'apps/web/package.json': JSON.stringify({
      name: '@gym/web',
      type: 'module',
      dependencies: { 'date-fns': '4.4.0' },
    }),
    'apps/web/node_modules/date-fns/package.json': JSON.stringify({
      name: 'date-fns',
      type: 'module',
      version: '4.4.0',
      exports: { './addDays': './addDays.js' },
    }),
    'apps/web/node_modules/date-fns/addDays.js': 'export const addDays = () => {};',
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /datetime-library-owner/);
  assert.match(result.stdout, /node_modules\/date-fns\/addDays.js/);
});

test('datetime is a leaf and cannot import another shared workspace', () => {
  const result = cruise({
    'packages/datetime/src/index.js': "import '../../domain/src/index.js';",
    'packages/domain/src/index.js': 'export const value = 1;',
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /datetime-no-outward-workspace-imports/);
});

test('datetime ownership rejects imports resolved from hoisted root node_modules', () => {
  const result = cruise({
    'apps/web/src/index.js': "import { addDays } from 'date-fns/addDays';",
    'apps/web/package.json': JSON.stringify({ name: '@gym/web', type: 'module' }),
    'node_modules/date-fns/package.json': JSON.stringify({
      name: 'date-fns',
      type: 'module',
      version: '4.4.0',
      exports: { './addDays': './addDays.js' },
    }),
    'node_modules/date-fns/addDays.js': 'export const addDays = () => {};',
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /datetime-library-owner/);
  assert.match(result.stdout, /node_modules\/date-fns\/addDays.js/);
});

test('datetime itself cannot import competing date libraries', () => {
  const result = cruise({
    'packages/datetime/src/index.js': "import 'luxon'; import '@date-fns/utc';",
    'packages/datetime/test/index.js': "import 'dayjs';",
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /datetime-no-competing-library/);
  assert.match(result.stdout, /packages\/datetime\/test\/index.js/);
});
