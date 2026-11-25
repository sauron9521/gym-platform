import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import {
  clearProgramWorkoutAttempt,
  getProgramWorkoutAttempt,
} from '../src/features/programs/lib/program-workout-attempt.ts';

test('program workout keys remain stable until confirmed success', () => {
  const attempts = new Map();
  let created = 0;
  const keyFactory = () => `mobile-attempt-${++created}`;

  const first = getProgramWorkoutAttempt(attempts, 'assignment-a', 'day-1', keyFactory);
  const retry = getProgramWorkoutAttempt(attempts, 'assignment-a', 'day-1', keyFactory);
  assert.equal(first, 'mobile-attempt-1');
  assert.equal(retry, first);
  assert.equal(created, 1, 'manual retry must not create a new key');

  const nextDay = getProgramWorkoutAttempt(attempts, 'assignment-a', 'day-2', keyFactory);
  const otherAssignment = getProgramWorkoutAttempt(attempts, 'assignment-b', 'day-1', keyFactory);
  assert.notEqual(nextDay, first);
  assert.notEqual(otherAssignment, first);

  clearProgramWorkoutAttempt(attempts, 'assignment-a', 'day-1');
  const afterSuccess = getProgramWorkoutAttempt(attempts, 'assignment-a', 'day-1', keyFactory);
  assert.notEqual(afterSuccess, first);
});

test('assigned programs use typed API and never retry writes automatically', () => {
  const file = readFileSync(
    new URL('../src/features/programs/model/program-assignments-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(file, /GET\('\/training-programs\/assignments'/);
  assert.match(file, /GET\('\/training-programs\/assignments\/\{assignmentId\}'/);
  assert.match(file, /POST\('\/workouts\/from-program'/);
  assert.match(file, /'Idempotency-Key': key/);
  assert.match(file, /getProgramWorkoutAttempt/);
  assert.match(file, /clearProgramWorkoutAttempt/);
  assert.match(file, /retry: false/);
  assert.match(file, /!hasAthleteAccess\(capabilities\)/);
  assert.doesNotMatch(file, /getQueryData\(accountQueryKeys\.me/);
});

test('program navigation is protected without dropping athlete workout creation', () => {
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  const tabs = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /name="programs\/\[id\]"/);
  assert.match(layout, /name="workouts\/new"/);
  assert.match(layout, /mode="dark"/);
  assert.match(tabs, /<Tabs.Protected guard=\{hasAthleteAccess\(capabilities\)\}>/);
  assert.match(layout, /name="programs\/index"/);
});
