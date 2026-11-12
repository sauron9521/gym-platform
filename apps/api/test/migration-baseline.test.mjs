import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = JSON.parse(readFileSync(join(root, 'migration-baseline.json'), 'utf8'));

test('historical SQL migrations and migration lock remain unchanged', () => {
  assert.equal(baseline.source_repository, 'sauron9521/gym-api-nestjs');

  const originalFiles = Object.entries(baseline.migration_files);
  assert.ok(originalFiles.length >= 25, 'Expected existing migration history');

  for (const [relativePath, expectedSha] of originalFiles) {
    const fullPath = join(root, relativePath);
    assert.ok(existsSync(fullPath), 'Missing migration: ' + relativePath);

    const buffer = readFileSync(fullPath);
    const actualSha = createHash('sha1')
      .update('blob ' + buffer.length + '\0')
      .update(buffer)
      .digest('hex');
    assert.equal(actualSha, expectedSha, 'Historical migration changed: ' + relativePath);
  }

  const directories = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert.ok(directories.length >= 24);
  assert.ok(directories.every((name) => /^\d{14}_[a-z0-9_]+$/.test(name)));
});

test('all original Prisma schema files are present', () => {
  const schemaPath = join(root, 'prisma/schemas');
  const actualNames = readdirSync(schemaPath)
    .filter((name) => name.endsWith('.prisma'))
    .sort();
  assert.deepEqual(actualNames, baseline.schema_files);

  for (const name of actualNames) {
    assert.ok(readFileSync(join(schemaPath, name), 'utf8').trim());
  }

  const primary = readFileSync(join(schemaPath, 'schema.prisma'), 'utf8');
  assert.match(primary, /provider\s*=\s*"postgresql"/);
  assert.match(primary, /output\s*=\s*"\.\.\/\.\.\/src\/infra\/database\/generated\/prisma"/);
});

test('PostgreSQL migration provider is maintained', () => {
  const lock = readFileSync(join(root, 'prisma/migrations/migration_lock.toml'), 'utf8');
  assert.match(lock, /provider\s*=\s*"postgresql"/);
});
