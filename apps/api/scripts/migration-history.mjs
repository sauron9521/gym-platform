import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const initialBaseline = '20261114000000_initial_baseline';

/**
 * Keep the original baseline first, and require each subsequent migration
 * to use Prisma's timestamped directory format and contain non-empty SQL.
 */
export function listValidatedMigrationNames(migrationsRoot) {
  const names = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.equal(names[0], initialBaseline, 'The frozen initial baseline must be first');
  for (const name of names.slice(1)) {
    assert.match(name, /^\d{14}_[a-z0-9_]+$/, `Invalid migration directory: ${name}`);
    const sql = readFileSync(join(migrationsRoot, name, 'migration.sql'), 'utf8');
    assert.ok(sql.trim(), `Migration ${name} must contain non-empty SQL`);
  }
  return names;
}
