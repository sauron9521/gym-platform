import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildCreateProgramWorkoutPayload,
  createProgramWorkoutSchema,
  getCreateProgramWorkoutError,
  getProgramWorkoutsLoadError,
  isWeekWithinDuration,
  sortProgramWorkouts,
} from '../src/features/training-programs/lib/create-program-workout.ts';

const valid = {
  weekNumber: '2',
  dayNumber: '3',
  title: '  Силовий день  ',
  notes: '  Присідання та жим  ',
};

test('workout day form requires valid week, day and title', () => {
  assert.equal(createProgramWorkoutSchema.safeParse(valid).success, true);
  for (const weekNumber of ['', '0', '53', '1.5', '-1', 'one']) {
    assert.equal(createProgramWorkoutSchema.safeParse({ ...valid, weekNumber }).success, false);
  }
  for (const dayNumber of ['', '0', '8', '1.2', '-1', 'Mo']) {
    assert.equal(createProgramWorkoutSchema.safeParse({ ...valid, dayNumber }).success, false);
  }
  assert.equal(createProgramWorkoutSchema.safeParse({ ...valid, title: ' ' }).success, false);
  assert.equal(
    createProgramWorkoutSchema.safeParse({ ...valid, notes: 'x'.repeat(5001) }).success,
    false,
  );
  assert.equal(
    createProgramWorkoutSchema.safeParse({ ...valid, weekNumber: '52', dayNumber: '7' }).success,
    true,
  );
});

test('typed workout day payload normalizes fields and omits empty optional notes', () => {
  assert.deepEqual(buildCreateProgramWorkoutPayload(createProgramWorkoutSchema.parse(valid)), {
    weekNumber: 2,
    dayNumber: 3,
    title: 'Силовий день',
    notes: 'Присідання та жим',
  });
  assert.deepEqual(
    buildCreateProgramWorkoutPayload(
      createProgramWorkoutSchema.parse({ ...valid, weekNumber: '1', notes: ' ' }),
    ),
    { weekNumber: 1, dayNumber: 3, title: 'Силовий день' },
  );
});

test('program duration restricts creation to existing weeks', () => {
  assert.equal(isWeekWithinDuration(2, 2), true);
  assert.equal(isWeekWithinDuration(3, 2), false);
  assert.equal(isWeekWithinDuration(52, null), true);
});

test('workout list is sorted by week and day without mutating source', () => {
  const workouts = [
    { weekNumber: 2, dayNumber: 1 },
    { weekNumber: 1, dayNumber: 3 },
    { weekNumber: 1, dayNumber: 1 },
  ];
  assert.deepEqual(
    sortProgramWorkouts(workouts).map((item) => [item.weekNumber, item.dayNumber]),
    [
      [1, 1],
      [1, 3],
      [2, 1],
    ],
  );
  assert.equal(workouts[0]?.weekNumber, 2);
});

test('API errors do not include raw server details', () => {
  assert.notEqual(getCreateProgramWorkoutError(400), getCreateProgramWorkoutError(409));
  assert.notEqual(getCreateProgramWorkoutError(429), getCreateProgramWorkoutError());
  assert.equal(getCreateProgramWorkoutError(404), getCreateProgramWorkoutError(403));
  assert.equal(getProgramWorkoutsLoadError(404), getProgramWorkoutsLoadError(403));
});

test('program details loads version workouts; creation uses the typed API path', async () => {
  const root = '../src/features/training-programs/ui/';
  const details = await readFile(
    new URL(root + 'trainer-program-details.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL(root + 'training-program-workouts.tsx', import.meta.url),
    'utf8',
  );
  const form = await readFile(
    new URL(root + 'create-program-workout-form.tsx', import.meta.url),
    'utf8',
  );

  const query = await readFile(
    new URL('../src/features/training-programs/api/training-program-version-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(details, /TrainingProgramWorkouts/);
  assert.match(list, /useQuery\(trainingProgramVersionQueryOptions\(programId, versionId\)\)/);
  assert.match(list, /query.refetch\(\)/);
  assert.match(list, /queryClient.clear\(\)/);
  assert.match(list, /router.replace\('\/login'\)/);
  assert.match(list, /if \(unauthenticated\) return null/);
  assert.match(list, /queryClient.setQueryData/);
  assert.match(list, /editable && version.status === 'DRAFT'/);
  assert.match(query, /GET\(/);
  assert.match(query, /'\/training-programs\/\{programId\}\/versions\/\{versionId\}'/);
  assert.match(query, /signal,/);
  assert.match(query, /response.status !== 200/);
  assert.match(query, /retry: false/);
  assert.match(form, /zodResolver\(createProgramWorkoutSchema\)/);
  assert.match(form, /POST\(/);
  assert.match(form, /'\/training-programs\/\{programId\}\/versions\/\{versionId\}\/workouts'/);
  assert.match(form, /response.status !== 201/);
  assert.match(form, /isWeekWithinDuration/);
  for (const source of [details, list, form, query]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
