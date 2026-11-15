import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildUpdateProgramWorkoutPayload,
  editProgramWorkoutSchema,
  getProgramWorkoutMutationError,
} from '../src/features/training-programs/lib/edit-program-workout.ts';

const values = {
  weekNumber: '2',
  dayNumber: '3',
  title: '  Силовий день  ',
  notes: '  Оновлені примітки  ',
};

test('edit workout validates all required fields consistently with creation', () => {
  assert.equal(editProgramWorkoutSchema.safeParse(values).success, true);
  for (const weekNumber of ['0', '53', '2.5', '']) {
    assert.equal(editProgramWorkoutSchema.safeParse({ ...values, weekNumber }).success, false);
  }
  for (const dayNumber of ['0', '8', '']) {
    assert.equal(editProgramWorkoutSchema.safeParse({ ...values, dayNumber }).success, false);
  }
  assert.equal(editProgramWorkoutSchema.safeParse({ ...values, title: ' ' }).success, false);
  assert.equal(
    editProgramWorkoutSchema.safeParse({ ...values, notes: 'x'.repeat(5001) }).success,
    false,
  );
});

test('typed PATCH payload trims data and explicitly clears notes with null', () => {
  assert.deepEqual(buildUpdateProgramWorkoutPayload(editProgramWorkoutSchema.parse(values)), {
    weekNumber: 2,
    dayNumber: 3,
    title: 'Силовий день',
    notes: 'Оновлені примітки',
  });
  assert.deepEqual(
    buildUpdateProgramWorkoutPayload(editProgramWorkoutSchema.parse({ ...values, notes: ' ' })),
    { weekNumber: 2, dayNumber: 3, title: 'Силовий день', notes: null },
  );
});

test('mutation error messages do not surface untrusted API response details', () => {
  assert.equal(
    getProgramWorkoutMutationError('edit', 404),
    getProgramWorkoutMutationError('edit', 403),
  );
  assert.notEqual(
    getProgramWorkoutMutationError('edit', 409),
    getProgramWorkoutMutationError('edit'),
  );
  assert.notEqual(getProgramWorkoutMutationError('delete'), getProgramWorkoutMutationError('edit'));
});

test('draft-only edit/delete UI uses typed operations and explicit delete confirmation', async () => {
  const base = '../src/features/training-programs/ui/';
  const list = await readFile(
    new URL(base + 'training-program-workouts.tsx', import.meta.url),
    'utf8',
  );
  const item = await readFile(new URL(base + 'program-workout-item.tsx', import.meta.url), 'utf8');
  const edit = await readFile(
    new URL(base + 'edit-program-workout-form.tsx', import.meta.url),
    'utf8',
  );

  const mutations = await readFile(
    new URL('../src/features/training-programs/api/program-workout-mutations.ts', import.meta.url),
    'utf8',
  );

  assert.match(list, /editable=\{editable && version.status === 'DRAFT'\}/);
  assert.match(item, /confirmDelete &&/);
  assert.match(item, /if \(!confirmDelete \|\| deleteMutation.isPending\) return/);
  assert.match(item, /useDeleteProgramWorkoutMutation\(programId, versionId\)/);
  assert.match(item, /deleteMutation.mutateAsync\(workout.id\)/);
  assert.match(edit, /useEditProgramWorkoutMutation\(programId, versionId\)/);
  assert.match(edit, /mutation.mutateAsync\(\{ workoutId: workout.id, body: payload \}\)/);
  assert.match(mutations, /webApi.DELETE\(/);
  assert.match(mutations, /webApi.PATCH\(/);
  assert.match(mutations, /onSuccess: updateVersion/);
  assert.match(mutations, /useAuthFailure\(\)/);
  assert.match(mutations, /retry: false/);
  assert.doesNotMatch(item + edit, /webApi.PATCH|webApi.DELETE|router.replace/);
  assert.match(edit, /zodResolver\(editProgramWorkoutSchema\)/);
  assert.match(edit, /isWeekWithinDuration/);
  assert.match(mutations, /response.status !== 200/);
  for (const source of [list, item, edit, mutations]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
