import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'vitest';

import { accountQueryKeys } from '../src/shared/api/query-client.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('details keys isolate workout and account identities', () => {
  assert.notDeepEqual(
    accountQueryKeys.workoutDetail('user-1', 'workout-1'),
    accountQueryKeys.workoutDetail('user-2', 'workout-1'),
  );
  assert.notDeepEqual(
    accountQueryKeys.workoutDetail('user-1', 'workout-1'),
    accountQueryKeys.workoutDetail('user-1', 'workout-2'),
  );
});

test('protected detail route uses typed API and account-scoped invalidation', () => {
  const root = read('../src/app/_layout.tsx');
  const query = read('../src/features/workouts/model/workout-details-query.ts');
  const list = read('../src/screens/workouts/ui/workouts-screen.tsx');
  const screen = read('../src/screens/workouts/ui/workout-details-screen.tsx');
  assert.ok(existsSync(new URL('../src/app/workouts/[id].tsx', import.meta.url)));
  assert.match(root, /name="workouts\/\[id\]"/);
  assert.match(query, /api\.GET\('\/workouts\/\{id\}'/);
  assert.match(query, /api\.POST\('\/workouts\/\{id\}\/start'/);
  assert.match(query, /api\.POST\('\/workouts\/\{id\}\/complete'/);
  assert.match(query, /accountQueryKeys\.workoutDetail/);
  assert.match(query, /accountQueryKeys\.workouts\(account\.id\)/);
  assert.match(query, /isSessionExpired\(response\.response\.status\)/);
  assert.match(query, /mobileReadError\(response\.response\.status/);
  assert.match(query, /getQueryData\(accountQueryKeys\.me\(account\.id\)\)/);
  assert.match(list, /testID="workouts-refresh"/);
  assert.match(list, /router\.push/);
  assert.match(screen, /useWorkoutDetailsQuery/);
  assert.doesNotMatch(query, /localStorage|AsyncStorage|console\.log/);
});
