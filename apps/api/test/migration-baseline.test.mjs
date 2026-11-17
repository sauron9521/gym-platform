import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

import { initialBaseline, listValidatedMigrationNames } from '../scripts/migration-history.mjs';

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

  const ordered = listValidatedMigrationNames(join(root, 'prisma/migrations'));
  assert.equal(ordered[0], initialBaseline);

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

function withTemporaryMigrationDirectory(check) {
  const migrationsRoot = mkdtempSync(join(tmpdir(), 'gym-migration-history-'));
  try {
    mkdirSync(join(migrationsRoot, initialBaseline));
    check(migrationsRoot);
  } finally {
    rmSync(migrationsRoot, { recursive: true, force: true });
  }
}

test('a valid non-empty incremental migration is accepted after the frozen baseline', () => {
  withTemporaryMigrationDirectory((migrationsRoot) => {
    const name = '20261117120000_add_preferred_locale';
    mkdirSync(join(migrationsRoot, name));
    writeFileSync(join(migrationsRoot, name, 'migration.sql'), 'ALTER TABLE "users" ADD COLUMN "preferredLocale" TEXT;');

    assert.deepEqual(listValidatedMigrationNames(migrationsRoot), [initialBaseline, name]);
  });
});

test.each([
  ['malformed directory name', '20261117120000-add-locale', 'SELECT 1;', /Invalid migration directory/],
  ['empty migration', '20261117120000_add_locale', '   ', /non-empty SQL/],
])('incremental migration validation rejects %s', (_description, name, sql, expected) => {
  withTemporaryMigrationDirectory((migrationsRoot) => {
    mkdirSync(join(migrationsRoot, name));
    writeFileSync(join(migrationsRoot, name, 'migration.sql'), sql);
    assert.throws(() => listValidatedMigrationNames(migrationsRoot), expected);
  });
});

test('incremental migration validation rejects missing migration.sql', () => {
  withTemporaryMigrationDirectory((migrationsRoot) => {
    mkdirSync(join(migrationsRoot, '20261117120000_missing_sql'));
    assert.throws(
      () => listValidatedMigrationNames(migrationsRoot),
      /ENOENT/,
    );
  });
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
