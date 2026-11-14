import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createExerciseFormSchema } from '../src/features/exercises/lib/create-exercise.ts';
import {
  buildUpdateExercisePayload,
  canManageCustomExercise,
  getEditExerciseDefaults,
  getExerciseMutationErrorMessage,
} from '../src/features/exercises/lib/manage-exercise.ts';

const exercise = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Жим гантелей',
  description: 'Початковий опис',
  instructions: 'Виконуйте плавно',
  source: 'ATHLETE_CUSTOM',
  visibility: 'PRIVATE',
  exerciseType: 'STRENGTH',
  isArchived: false,
  createdById: 'owner-1',
  muscleGroups: [
    { muscleGroup: { id: 'muscle-1', slug: 'shoulders', name: 'Плечі' }, role: 'PRIMARY' },
    { muscleGroup: { id: 'muscle-2', slug: 'triceps', name: 'Трицепс' }, role: 'SECONDARY' },
  ],
  equipment: [{ equipment: { id: 'equipment-1', slug: 'dumbbell', name: 'Гантелі' } }],
};

test('only owners of unarchived, nonglobal custom exercises can edit and archive', () => {
  assert.equal(canManageCustomExercise(exercise, { id: 'owner-1', role: 'ATHLETE' }), true);
  assert.equal(canManageCustomExercise(exercise, { id: 'other', role: 'ATHLETE' }), false);
  assert.equal(canManageCustomExercise(exercise, { id: 'owner-1', role: 'TRAINER' }), false);
  assert.equal(
    canManageCustomExercise({ ...exercise, source: 'GLOBAL' }, { id: 'owner-1', role: 'ADMIN' }),
    false,
  );
  assert.equal(
    canManageCustomExercise({ ...exercise, isArchived: true }, { id: 'owner-1', role: 'ATHLETE' }),
    false,
  );
  assert.equal(
    canManageCustomExercise(
      { ...exercise, source: 'TRAINER_CUSTOM' },
      { id: 'owner-1', role: 'TRAINER' },
    ),
    true,
  );
});

test('edit defaults include current editable values and relations', () => {
  assert.deepEqual(getEditExerciseDefaults(exercise), {
    name: 'Жим гантелей',
    description: 'Початковий опис',
    instructions: 'Виконуйте плавно',
    exerciseType: 'STRENGTH',
    visibility: 'PRIVATE',
    muscleGroups: [
      { slug: 'shoulders', role: 'PRIMARY' },
      { slug: 'triceps', role: 'SECONDARY' },
    ],
    equipment: ['dumbbell'],
  });
  assert.equal(createExerciseFormSchema.safeParse(getEditExerciseDefaults(exercise)).success, true);
});

test('unchanged values never trigger a PATCH request', () => {
  assert.deepEqual(
    buildUpdateExercisePayload(getEditExerciseDefaults(exercise), exercise, 'ATHLETE'),
    {},
  );
});

test('edited fields map to existing PATCH endpoint and clearing text becomes null', () => {
  const values = {
    ...getEditExerciseDefaults(exercise),
    name: 'Новий жим',
    description: '',
    instructions: '  Оновлена техніка  ',
    visibility: 'SELECTED_TRAINERS',
    muscleGroups: [{ slug: 'chest', role: 'PRIMARY' }],
    equipment: [],
  };
  const parsed = createExerciseFormSchema.parse(values);
  assert.deepEqual(buildUpdateExercisePayload(parsed, exercise, 'ATHLETE'), {
    name: 'Новий жим',
    description: null,
    instructions: 'Оновлена техніка',
    visibility: 'SELECTED_TRAINERS',
    muscleGroups: [{ slug: 'chest', role: 'PRIMARY' }],
    equipment: [],
  });
});

test('trainer edits cannot send athlete-only visibility', () => {
  const values = { ...getEditExerciseDefaults(exercise), visibility: 'SELECTED_TRAINERS' };
  assert.deepEqual(
    buildUpdateExercisePayload(values, { ...exercise, source: 'TRAINER_CUSTOM' }, 'TRAINER'),
    {},
  );
});

test('mutation errors are safe and distinguish access from rate limits', () => {
  assert.equal(getExerciseMutationErrorMessage(), getExerciseMutationErrorMessage(500));
  assert.equal(getExerciseMutationErrorMessage(403), getExerciseMutationErrorMessage(404));
  assert.notEqual(getExerciseMutationErrorMessage(400), getExerciseMutationErrorMessage(429));
});

test('owner-only UI uses typed mutation endpoints and inline confirmation', async () => {
  const details = await readFile(
    new URL('../src/features/exercises/ui/exercise-details.tsx', import.meta.url),
    'utf8',
  );
  const edit = await readFile(
    new URL('../src/features/exercises/ui/edit-exercise-form.tsx', import.meta.url),
    'utf8',
  );
  const route = await readFile(
    new URL('../src/app/(protected)/exercises/[id]/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(route, /actor=\{session.user\}/);
  assert.match(details, /canManageCustomExercise/);
  assert.match(details, /webApi.DELETE\('\/exercises\/\{id\}'/);
  assert.match(details, /archiveConfirmation/);
  assert.match(details, /data\?\.isArchived/);
  assert.match(details, /router.replace\('\/exercises'\)/);
  assert.match(edit, /useFieldArray/);
  assert.match(edit, /zodResolver\(editExerciseSchema\)/);
  assert.match(edit, /webApi.PATCH\('\/exercises\/\{id\}'/);
  assert.match(edit, /response.status === 401/);
  assert.match(edit, /onSaved\(data\)/);
  assert.doesNotMatch(details + edit, /localStorage|sessionStorage|window.confirm/);
});
