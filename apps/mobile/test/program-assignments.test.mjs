import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('athlete program views use typed assignment and idempotent workout creation', () => {
  const file = readFileSync(
    new URL('../src/features/programs/model/program-assignments-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(file, /GET\('\/training-programs\/assignments'/);
  assert.match(file, /GET\('\/training-programs\/assignments\/\{assignmentId\}'/);
  assert.match(file, /POST\('\/workouts\/from-program'/);
  assert.match(file, /Idempotency-Key/);
  assert.match(file, /retry: false/);
});
