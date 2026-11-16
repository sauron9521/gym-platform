import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('exercise catalog supports backend search, group and equipment filters with pagination', () => {
  const query = readFileSync(
    new URL('../src/features/exercises/model/exercises-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(query, /GET\('\/exercises'/);
  assert.match(query, /GET\('\/exercises\/muscle-groups'/);
  assert.match(query, /GET\('\/exercises\/equipment'/);
  assert.match(query, /useInfiniteQuery/);
  assert.match(query, /meta\.totalPages/);
});
