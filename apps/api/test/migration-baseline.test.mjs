import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'migration-baseline.json'), 'utf8'));
const expectedBaseline = 'prisma/migrations/20261114000000_initial_baseline/migration.sql';

function gitBlobSha(buffer) {
  return createHash('sha1')
    .update('blob ' + buffer.length + '\0')
    .update(buffer)
    .digest('hex');
}

test('one Prisma-generated baseline for an empty database is frozen', () => {
  assert.equal(manifest.source_repository, 'sauron9521/gym-api-nestjs');
  assert.equal(manifest.current_baseline.path, expectedBaseline);
  assert.equal(manifest.current_baseline.consolidated_migrations, 24);
  assert.equal(manifest.current_baseline.requires_empty_database, true);
  assert.equal(
    manifest.current_baseline.generator,
    'prisma migrate diff --from-empty --to-schema prisma/schemas --config prisma7.config.ts --script',
  );
  assert.deepEqual(manifest.current_baseline.manual_constraints, [
    'body_measurements_at_least_one_metric',
  ]);

  const source = Object.keys(manifest.historical_migration_files)
    .filter((path) => path.endsWith('/migration.sql'))
    .sort();
  assert.equal(source.length, 24, 'Expected 24 archived legacy source migration hashes');

  const dirs = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.deepEqual(dirs, ['20261114000000_initial_baseline']);

  const buffer = readFileSync(join(root, expectedBaseline));
  assert.equal(gitBlobSha(buffer), manifest.current_baseline.git_blob_sha);
  const sql = buffer.toString('utf8');
  assert.equal((sql.match(/CREATE TABLE /g) ?? []).length, 24);
  assert.doesNotMatch(sql, /Historical step \d+ of 24/);
  assert.doesNotMatch(sql, /\b(?:DROP TABLE|DROP TYPE|DROP INDEX)\b/i);
  assert.doesNotMatch(sql, /\b(?:CREATE|DROP)\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i);
  for (const name of [
    'trainer_athletes_open_pair_key',
    'training_program_versions_one_draft_key',
    'training_program_assignments_one_active_version_key',
  ]) {
    assert.ok(sql.includes('CREATE UNIQUE INDEX "' + name + '"'));
  }
  assert.equal((sql.match(/WHERE \(/g) ?? []).length, 3);
  assert.match(sql, /CONSTRAINT "body_measurements_at_least_one_metric"\s+CHECK\s*\(/);
  assert.match(sql, /ALTER TABLE "body_measurements"/);
});

test('all source Prisma schema files remain intact', () => {
  const schemaPath = join(root, 'prisma/schemas');
  const names = readdirSync(schemaPath)
    .filter((name) => name.endsWith('.prisma'))
    .sort();
  assert.deepEqual(names, manifest.schema_files);

  for (const name of names) {
    assert.ok(readFileSync(join(schemaPath, name), 'utf8').trim());
  }
  const primary = readFileSync(join(schemaPath, 'schema.prisma'), 'utf8');
  assert.match(primary, /provider\s*=\s*"postgresql"/);
  assert.match(primary, /output\s*=\s*"\.\.\/\.\.\/src\/infra\/database\/generated\/prisma"/);
});

test('PostgreSQL migration provider lock remains present', () => {
  const lock = readFileSync(join(root, 'prisma/migrations/migration_lock.toml'), 'utf8');
  assert.match(lock, /provider\s*=\s*"postgresql"/);
});
