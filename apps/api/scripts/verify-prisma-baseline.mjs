import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const migrationPath = join(root, 'prisma/migrations/20261114000000_initial_baseline/migration.sql');
const sql = readFileSync(migrationPath, 'utf8');
const marker = '-- Manual PostgreSQL constraints not represented by Prisma Schema.\n';
const at = sql.indexOf(marker);
assert.ok(at > 0, 'The manual constraint separator must appear once after Prisma-generated SQL');
assert.equal(sql.indexOf(marker, at + 1), -1, 'Duplicate manual constraint separator');

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
