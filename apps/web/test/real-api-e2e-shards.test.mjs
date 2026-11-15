import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseRealApiShardConfig, selectRealApiSpecs } from '../scripts/real-api-e2e-shards.mjs';

const integrationDir = fileURLToPath(new URL('../e2e/integration/', import.meta.url));
const specs = readdirSync(integrationDir, { recursive: true })
  .filter((file) => file.endsWith('.spec.ts'))
  .map((file) => file.replaceAll('\\', '/'))
  .sort();

test('unsharded local runs execute every real API browser spec', () => {
  const defaultConfig = parseRealApiShardConfig({});
  assert.deepEqual(defaultConfig, { index: 1, count: 1 });
  assert.deepEqual(selectRealApiSpecs(specs, defaultConfig), specs);
});

test('all real API specs are assigned exactly once to four nonempty shards', () => {
  assert.ok(specs.length >= 4, 'Expected the real API suite to have at least four specs');
  const shards = Array.from({ length: 4 }, (_, offset) =>
    selectRealApiSpecs(specs, { index: offset + 1, count: 4 }),
  );
  assert.ok(shards.every((files) => files.length > 0), 'Every CI shard must run tests');
  assert.equal(shards.flat().length, specs.length);
  assert.deepEqual([...shards.flat()].sort(), specs);
  assert.equal(new Set(shards.flat()).size, specs.length);

  for (let i = 0; i < shards.length; i += 1) {
    assert.deepEqual(
      shards[i],
      specs.filter((_, position) => position % 4 === i),
      'Shard selection must be deterministic',
    );
  }
});

test('invalid or partially configured CI shards fail instead of silently skipping specs', () => {
  for (const env of [
    { WEB_E2E_SHARD_INDEX: '1' },
    { WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '0', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '5', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '1', WEB_E2E_SHARD_COUNT: '0' },
    { WEB_E2E_SHARD_INDEX: '1', WEB_E2E_SHARD_COUNT: '33' },
    { WEB_E2E_SHARD_INDEX: '1.2', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '01', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '', WEB_E2E_SHARD_COUNT: '4' },
  ]) {
    assert.throws(() => parseRealApiShardConfig(env));
  }
  assert.deepEqual(
    parseRealApiShardConfig({ WEB_E2E_SHARD_INDEX: '2', WEB_E2E_SHARD_COUNT: '4' }),
    { index: 2, count: 4 },
  );

  assert.throws(() => selectRealApiSpecs([], { index: 1, count: 1 }));
  assert.throws(() => selectRealApiSpecs(['only.spec.ts'], { index: 4, count: 4 }));
  assert.throws(() => selectRealApiSpecs(specs, { index: 5, count: 4 }));
});
