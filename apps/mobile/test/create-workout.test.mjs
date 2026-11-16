import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import {
  buildMobileWorkoutBody,
  mobileWorkoutFormSchema,
  resolveWorkoutCreationAttempt,
} from '../src/features/workouts/lib/create-workout-schema.ts';

const valid = {
  title: '  День грудей ',
  exerciseId: '11111111-1111-4111-8111-111111111111',
  reps: '12',
};

test('mobile workout creation requires a title, accessible exercise and valid reps', () => {
  assert.equal(mobileWorkoutFormSchema.safeParse(valid).success, true);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, reps: '0' }).success, false);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, reps: '1001' }).success, false);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, reps: '1.5' }).success, false);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, reps: 'NaN' }).success, false);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, exerciseId: '' }).success, false);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, title: 'x' }).success, false);
});

test('one-exercise typed payload includes no credentials or unrequested fields', () => {
  assert.deepEqual(
    buildMobileWorkoutBody({
      title: valid.title,
      exerciseId: valid.exerciseId,
      plannedReps: 12,
    }),
    {
      title: 'День грудей',
      exercises: [
        {
          exerciseId: valid.exerciseId,
          sets: [{ setType: 'WORKING', plannedReps: 12 }],
        },
      ],
    },
  );
});

test('create route is protected and mutation only navigates after success', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const layout = read('../src/app/_layout.tsx');
  const screen = read('../src/screens/workouts/ui/create-workout-screen.tsx');
  const model = read('../src/features/workouts/model/workout-create.ts');
  assert.match(layout, /name="workouts\/new"/);
  assert.match(screen, /await createWorkout\.mutateAsync/);
  assert.match(screen, /router\.back\(\)/);
  assert.match(model, /api\.POST\('\/workouts'/);
  assert.match(model, /accountQueryKeys\.workouts/);
});

test('same canonical workout reuses the original key after an uncertain response', () => {
  let keys = 0;
  const createKey = () => `mobile-attempt-${++keys}`;
  const input = { title: 'День грудей', exerciseId: valid.exerciseId, plannedReps: 12 };
  const initial = resolveWorkoutCreationAttempt(input, null, createKey);
  const retry = resolveWorkoutCreationAttempt(
    { ...input, title: ' День грудей ' },
    initial,
    createKey,
  );

  assert.equal(retry.key, initial.key);
  assert.equal(keys, 1);
  const changed = resolveWorkoutCreationAttempt({ ...input, plannedReps: 13 }, retry, createKey);
  assert.notEqual(changed.key, initial.key);
  assert.equal(keys, 2);
});

test('manual creation locks submission, sends idempotency header and refreshes scoped list', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const screen = read('../src/screens/workouts/ui/create-workout-screen.tsx');
  const list = read('../src/screens/workouts/ui/workouts-screen.tsx');
  const model = read('../src/features/workouts/model/workout-create.ts');

  assert.match(screen, /submitLock\.current/);
  assert.match(screen, /if \(submitLock\.current\) return/);
  assert.match(screen, /disabled=\{createWorkout\.isPending \|\| isSubmitting/);
  assert.match(model, /'Idempotency-Key': attempt\.current\.key/);
  assert.match(model, /retry: false/);
  assert.match(model, /invalidateQueries\(\{ queryKey: accountQueryKeys\.workouts/);
  assert.doesNotMatch(model, /getQueryData\(accountQueryKeys\.me/);
  assert.match(model, /account\.role !== 'ATHLETE'/);
  assert.match(list, /account\?\.role === 'ATHLETE'/);
});
