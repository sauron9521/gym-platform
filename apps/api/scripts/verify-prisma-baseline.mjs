import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const migrationPath = join(root, 'prisma/migrations/20261114000000_initial_baseline/migration.sql');
const sql = readFileSync(migrationPath, 'utf8');
const marker = '-- Manual PostgreSQL constraints not represented by Prisma Schema.\n';
const at = sql.indexOf(marker);
assert.ok(at > 0, 'The manual constraint separator must appear once after Prisma-generated SQL');
assert.equal(sql.indexOf(marker, at + 1), -1, 'Duplicate manual constraint separator');

// Once additive migrations exist, the *current* schema must no longer be
// identical to the initial baseline. The frozen SQL is hash-verified by the
// migration-baseline contract test, while migration application is validated
// separately against the integration database in CI.
const migrationNames = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.equal(migrationNames[0], '20261114000000_initial_baseline');
if (migrationNames.length > 1) {
  for (const name of migrationNames.slice(1)) {
    assert.match(name, /^\\d{14}_[a-z0-9_]+$/);
    assert.ok(readFileSync(join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8').trim());
  }
  console.log('Frozen baseline verified; incremental migration history detected.');
  process.exit(0);
}

const prismaGenerated = sql.slice(0, at).trimEnd() + '\n';
const command = [
  'exec',
  'prisma',
  'migrate',
  'diff',
  '--from-empty',
  '--to-schema',
  'prisma/schemas',
  '--config',
  'prisma7.config.ts',
  '--script',
];
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', command, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr || 'Prisma schema diff failed');
assert.equal(
  prismaGenerated,
  result.stdout.trimEnd() + '\n',
  'Committed Prisma baseline differs from current Prisma Schema: regenerate before production',
);
assert.match(sql.slice(at), /CONSTRAINT "body_measurements_at_least_one_metric"/);
console.log('Prisma initial baseline matches schema-generated SQL and retains manual CHECK.');
