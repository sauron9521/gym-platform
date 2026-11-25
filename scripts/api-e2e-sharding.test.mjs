import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

import { ApiE2eSequencer } from '../apps/api/test/support/e2e-sequencer.ts';

const root = fileURLToPath(new URL('../apps/api/', import.meta.url));
const specs = readdirSync(join(root, 'test'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.e2e-spec.ts'))
  .map((entry) => ({ moduleId: join(entry.parentPath, entry.name) }));

function selectShard(files, index) {
  return new ApiE2eSequencer({ config: { root, shard: { index, count: 2 } } }).shard(files);
}

test('the two API E2E shards deterministically cover each discovered spec once', async () => {
  assert.ok(specs.length > 2);
  const first = await selectShard(specs, 1);
  const second = await selectShard(specs, 2);
  assert.ok(first.length > 0 && second.length > 0);
  assert.deepEqual(
    [...first, ...second].map((file) => file.moduleId).sort(),
    specs.map((file) => file.moduleId).sort(),
  );
  assert.deepEqual(await selectShard(specs.toReversed(), 1), first);
  assert.deepEqual(await selectShard(specs.toReversed(), 2), second);
});

test('two new or filtered specs each get a shard despite the fixed CI overhead', async () => {
  const unknowns = ['new-a', 'new-b'].map((name) => ({
    moduleId: join(root, 'test', name + '.e2e-spec.ts'),
  }));
  const first = await selectShard(unknowns, 1);
  const second = await selectShard(unknowns, 2);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.deepEqual(new Set([...first, ...second]), new Set(unknowns));
});
