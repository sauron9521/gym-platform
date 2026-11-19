import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import {
  buildWorkoutSetPayload,
  getWorkoutSetDefaults,
  getWorkoutSetSubmitError,
  workoutSetFormSchema,
} from '../src/features/workouts/lib/workout-set-form.ts';

const values = {
  actualReps: '8',
  actualWeightKg: '82,50',
  actualDurationSeconds: '',
  actualDistanceMeters: '',
  restSeconds: '90',
  rpe: '8,5',
  rir: '2',
  notes: '  Гарний підхід  ',
};

test('set logging accepts decimal commas and sends exact typed values', () => {
  const result = workoutSetFormSchema.safeParse(values);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(buildWorkoutSetPayload('COMPLETED', result.data), {
    status: 'COMPLETED',
    actualReps: 8,
    actualWeightKg: 82.5,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    restSeconds: 90,
    rpe: 8.5,
    rir: 2,
    notes: 'Гарний підхід',
  });
});

test('set logging rejects negative, fractional reps, excess precision and invalid RPE/RIR', () => {
  for (const overrides of [
    { actualReps: '2.5' },
    { actualWeightKg: '-2' },
    { actualWeightKg: '4.555' },
    { actualDurationSeconds: '0' },
    { actualDistanceMeters: '2.123' },
    { restSeconds: '86401' },
    { rpe: '10.5' },
    { rir: '11' },
    { actualWeightKg: 'NaN' },
  ]) {
    assert.equal(workoutSetFormSchema.safeParse({ ...values, ...overrides }).success, false);
  }
});

test('skipping a set does not send actual performance values', () => {
  assert.deepEqual(buildWorkoutSetPayload('SKIPPED', values), { status: 'SKIPPED' });
});

test('existing set results are loaded as editable form defaults', () => {
  const set = {
    actualReps: 8,
    actualWeightKg: '82.50',
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    restSeconds: 90,
    rpe: '8.5',
    rir: 2,
    notes: 'Note',
  };
  assert.deepEqual(getWorkoutSetDefaults(set), {
    actualReps: '8',
    actualWeightKg: '82.50',
    actualDurationSeconds: '',
    actualDistanceMeters: '',
    restSeconds: '90',
    rpe: '8.5',
    rir: '2',
    notes: 'Note',
  });
  assert.equal(getWorkoutSetSubmitError(403), getWorkoutSetSubmitError(404));
  assert.equal(getWorkoutSetSubmitError(400), getWorkoutSetSubmitError(409));
});

test('set logging uses RHF, Zod and the typed PATCH endpoint, only during active workouts', async () => {
  const form = await readFile(
    new URL('../src/features/workouts/ui/workout-set-form.tsx', import.meta.url),
    'utf8',
  );
  const mutation = await readFile(
    new URL('../src/features/workouts/api/workout-set-mutation.ts', import.meta.url),
    'utf8',
  );
  const details = await readFile(
    new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
    'utf8',
  );
  assert.match(form, /useForm<WorkoutSetFormValues>/);
  assert.match(form, /zodResolver\(workoutSetFormSchema\)/);
  assert.match(form, /useUpdateWorkoutSetMutation\(workoutId\)/);
  assert.match(form, /mutation.mutateAsync\(\{/);
  assert.match(mutation, /webApi.PATCH\('\/workouts\/\{id\}\/sets\/\{setId\}'/);
  assert.match(mutation, /response.status !== 200/);
  assert.match(mutation, /useAuthFailure\(\)/);
  assert.match(mutation, /workoutQueryKeys.detail\(workoutId\)/);
  assert.match(mutation, /exact: true/);
  assert.match(mutation, /retry: false/);
  assert.match(form, /disabled=\{busy\}/);
  assert.doesNotMatch(form, /webApi.PATCH|router.replace|setError/);
  const exercises = await readFile(
    new URL('../src/features/workouts/ui/workout-exercises.tsx', import.meta.url),
    'utf8',
  );
  assert.match(details, /<WorkoutExercises/);
  const setCard = await readFile(
    new URL('../src/features/workouts/ui/workout-set-card.tsx', import.meta.url),
    'utf8',
  );
  assert.match(exercises, /<WorkoutSetCard/);
  assert.match(exercises, /workout.status === 'IN_PROGRESS'/);
  assert.match(setCard, /onSaved=\{\(\) => onEditSet\(null\)\}/);
  assert.match(setCard, /onClose=\{\(\) => onEditSet\(null\)\}/);
  assert.match(setCard, /<WorkoutSetForm/);
  assert.match(setCard, /disabled=\{editingLocked\}/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
