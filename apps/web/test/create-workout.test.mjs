import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildCreateWorkoutPayload,
  createEmptyWorkoutSet,
  createWorkoutExercise,
  createWorkoutFormSchema,
  getCreateWorkoutErrorMessage,
} from '../src/features/workouts/lib/create-workout.ts';

const exercise = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Жим лежачи',
};

function validWorkout() {
  return {
    title: 'Груди та трицепс',
    notes: '',
    scheduledAt: '',
    exercises: [
      {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        notes: '',
        sets: [{ ...createEmptyWorkoutSet(), plannedReps: '10', plannedWeightKg: '72,50' }],
      },
    ],
  };
}

test('valid workout maps to the typed API request with decimal numbers', () => {
  const parsed = createWorkoutFormSchema.safeParse(validWorkout());
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(buildCreateWorkoutPayload(parsed.data), {
    title: 'Груди та трицепс',
    notes: null,
    scheduledAt: null,
    exercises: [
      {
        exerciseId: exercise.id,
        notes: null,
        sets: [
          {
            setType: 'WORKING',
            plannedReps: 10,
            plannedWeightKg: 72.5,
            plannedDurationSeconds: null,
            plannedDistanceMeters: null,
            restSeconds: null,
            targetRpe: null,
            targetRir: null,
          },
        ],
      },
    ],
  });
});

test('createWorkoutExercise gives every new exercise one editable set', () => {
  const item = createWorkoutExercise(exercise);
  assert.equal(item.exerciseId, exercise.id);
  assert.equal(item.sets.length, 1);
  assert.equal(item.sets[0].setType, 'WORKING');
});

test('workout creation validates required exercises, sets and numeric precision', () => {
  const workout = validWorkout();
  assert.equal(createWorkoutFormSchema.safeParse({ ...workout, exercises: [] }).success, false);
  assert.equal(createWorkoutFormSchema.safeParse({ ...workout, title: 'X' }).success, false);
  assert.equal(
    createWorkoutFormSchema.safeParse({
      ...workout,
      exercises: [{ ...workout.exercises[0], sets: [] }],
    }).success,
    false,
  );
  assert.equal(
    createWorkoutFormSchema.safeParse({
      ...workout,
      exercises: [workout.exercises[0], workout.exercises[0]],
    }).success,
    false,
  );
  for (const invalid of ['-2', '5.555', 'NaN']) {
    assert.equal(
      createWorkoutFormSchema.safeParse({
        ...workout,
        exercises: [
          {
            ...workout.exercises[0],
            sets: [{ ...workout.exercises[0].sets[0], plannedWeightKg: invalid }],
          },
        ],
      }).success,
      false,
    );
  }
});

test('date input is converted to an ISO date and validation errors stay safe', () => {
  const parsed = createWorkoutFormSchema.safeParse({
    ...validWorkout(),
    scheduledAt: '2026-11-25T18:30',
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.match(buildCreateWorkoutPayload(parsed.data).scheduledAt, /Z$/);
  assert.equal(getCreateWorkoutErrorMessage(), getCreateWorkoutErrorMessage(500));
  assert.equal(getCreateWorkoutErrorMessage(403), getCreateWorkoutErrorMessage(404));
});

test('create page is guarded; web form uses typed API, RHF/Zod and stable retries', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/workouts/new/page.tsx', import.meta.url),
    'utf8',
  );
  const form = await readFile(
    new URL('../src/features/workouts/ui/create-workout-form.tsx', import.meta.url),
    'utf8',
  );
  const picker = await readFile(
    new URL('../src/features/workouts/ui/workout-exercise-picker.tsx', import.meta.url),
    'utf8',
  );
  const editor = await readFile(
    new URL('../src/features/workouts/ui/workout-exercise-editor.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL('../src/features/workouts/ui/workouts-list.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(form, /zodResolver\(createWorkoutFormSchema\)/);
  assert.match(form, /useFieldArray/);
  assert.match(form, /webApi.POST\('\/workouts'/);
  assert.match(form, /'Idempotency-Key'/);
  assert.match(form, /submitting.current/);
  assert.match(picker, /\.GET\('\/exercises'/);
  assert.match(editor, /createEmptyWorkoutSet/);
  assert.match(list, /href="\/workouts\/new"/);
  assert.doesNotMatch(form + picker, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
