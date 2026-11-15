import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import * as shards from '../scripts/real-api-e2e-shards.mjs';

const directory = new URL('../e2e/integration/', import.meta.url);
const entries = readdirSync(directory, { recursive: true });
const specs = entries
  .filter((file) => file.endsWith('.spec.ts'))
  .map((file) => file.replaceAll('\\', '/'))
  .sort();

test('local E2E runs include every integration spec', () => {
  const config = shards.parseRealApiShardConfig({});
  assert.deepEqual(config, { index: 1, count: 1 });
  assert.deepEqual(shards.selectRealApiSpecs(specs, config), specs);
});

test('the four CI shards cover every spec exactly once', () => {
  const covered = new Set();
  for (let index = 1; index <= 4; index += 1) {
    const selected = shards.selectRealApiSpecs(specs, { index, count: 4 });
    assert.ok(selected.length > 0);

    for (const spec of selected) {
      assert.equal(covered.has(spec), false);
      covered.add(spec);
    }

    const again = shards.selectRealApiSpecs(specs, { index, count: 4 });
    assert.deepEqual(again, selected);
  }
  assert.equal(covered.size, specs.length);
  assert.ok(specs.length >= 4);
});

test('invalid shard assignments fail closed', () => {
  const invalid = [
    { WEB_E2E_SHARD_INDEX: '1' },
    { WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '0', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '5', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '1', WEB_E2E_SHARD_COUNT: '0' },
    { WEB_E2E_SHARD_INDEX: '1', WEB_E2E_SHARD_COUNT: '33' },
    { WEB_E2E_SHARD_INDEX: '01', WEB_E2E_SHARD_COUNT: '4' },
    { WEB_E2E_SHARD_INDEX: '1.2', WEB_E2E_SHARD_COUNT: '4' },
  ];
  for (const config of invalid) {
    assert.throws(() => shards.parseRealApiShardConfig(config));
  }

  const config = { WEB_E2E_SHARD_INDEX: '2', WEB_E2E_SHARD_COUNT: '4' };
  assert.deepEqual(shards.parseRealApiShardConfig(config), { index: 2, count: 4 });
  assert.throws(() => shards.selectRealApiSpecs([], { index: 1, count: 1 }));
  assert.throws(() => shards.selectRealApiSpecs(['one.spec.ts'], { index: 4, count: 4 }));
});
