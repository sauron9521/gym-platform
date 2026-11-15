import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { workoutQueryKeys } from '../src/features/workouts/lib/workout-query-keys.ts';

test('workout query keys separate filter, pagination and list namespace', () => {
  assert.deepEqual(workoutQueryKeys.all, ['workouts']);
  assert.deepEqual(workoutQueryKeys.lists(), ['workouts', 'list']);
  assert.deepEqual(workoutQueryKeys.list('ALL', 1), [
    'workouts',
    'list',
    { filter: 'ALL', page: 1 },
  ]);
  assert.notDeepEqual(workoutQueryKeys.list('ALL', 1), workoutQueryKeys.list('ALL', 2));
  assert.notDeepEqual(workoutQueryKeys.list('ALL', 1), workoutQueryKeys.list('COMPLETED', 1));
});

test('workout detail keys isolate distinct workouts from list filters', () => {
  assert.deepEqual(workoutQueryKeys.details(), ['workouts', 'detail']);
  assert.deepEqual(workoutQueryKeys.detail('workout-1'), ['workouts', 'detail', 'workout-1']);
  assert.notDeepEqual(workoutQueryKeys.detail('workout-1'), workoutQueryKeys.detail('workout-2'));
  assert.notDeepEqual(workoutQueryKeys.detail('workout-1'), workoutQueryKeys.list('ALL', 1));
});


test('query provider is browser-scoped and cache clears on session changes', async () => {
  const provider = await readFile(new URL('../src/app/providers.tsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const login = await readFile(
    new URL('../src/features/auth/ui/sign-in-form.tsx', import.meta.url),
    'utf8',
  );
  const dashboard = await readFile(
    new URL('../src/widgets/dashboard/ui/dashboard-screen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(provider, /useState\(/);
  assert.match(provider, /new QueryClient\(/);
  assert.match(provider, /QueryClientProvider/);
  assert.match(layout, /<WebQueryProvider>/);
  assert.match(login, /queryClient.clear\(\)/);
  assert.match(dashboard, /queryClient.clear\(\)/);
  assert.doesNotMatch(provider, /localStorage|sessionStorage|persistQueryClient/);
});
