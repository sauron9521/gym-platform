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
  assert.match(query, /accountQueryKeys\.workouts\(request\.accountId\)/);
  assert.match(query, /isSessionExpired\(response\.response\.status\)/);
  assert.match(query, /mobileReadError\(response\.response\.status/);
  assert.match(query, /getQueryData\(accountQueryKeys\.me\(account\.id\)\)/);
  assert.match(list, /testID="workouts-refresh"/);
  assert.match(list, /router\.push/);
  const controller = read('../src/screens/workouts/model/use-workout-details.ts');
  assert.match(screen, /useWorkoutDetails\(id\)/);
  assert.match(controller, /useWorkoutDetailsQuery\(id\)/);
  assert.doesNotMatch(query, /localStorage|AsyncStorage|console\.log/);
});

test('only verified GET increments the account-scoped canonical read proof', () => {
  const query = read('../src/features/workouts/model/workout-details-query.ts');
  const mutation = read('../src/features/workouts/model/workout-set-mutation.ts');
  const screen = read('../src/screens/workouts/ui/workout-details-screen.tsx');
  assert.match(query, /workoutDetailRead\(account\.id, workoutId\)/);
  assert.match(query, /queryClient\.setQueryData<number>/);
  assert.doesNotMatch(mutation, /queryClient\.setQueryData<number>\(/);
  assert.match(screen, /canonicalReadVersion=\{details\.canonicalReadVersion\}/);
  assert.notDeepEqual(
    accountQueryKeys.workoutDetailRead('athlete', 'w'),
    accountQueryKeys.workoutDetailRead('coach', 'w'),
  );
});
