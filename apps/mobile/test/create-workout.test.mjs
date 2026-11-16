import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { mobileWorkoutFormSchema } from '../src/features/workouts/lib/create-workout-schema.ts';
import { buildMobileWorkoutBody } from '../src/features/workouts/model/workout-create.ts';

const valid = {
  title: '  День грудей ',
  exerciseId: '11111111-1111-4111-8111-111111111111',
  reps: '12',
};

test('mobile workout creation requires a title, accessible exercise and valid reps', () => {
  assert.equal(mobileWorkoutFormSchema.safeParse(valid).success, true);
  assert.equal(mobileWorkoutFormSchema.safeParse({ ...valid, reps: '0' }).success, false);
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
      exercises: [{
        exerciseId: valid.exerciseId,
        sets: [{ setType: 'WORKING', plannedReps: 12 }],
      }],
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
