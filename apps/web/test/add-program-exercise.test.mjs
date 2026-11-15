import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  addProgramExerciseSchema,
  buildAddProgramExercisePayload,
  getAddProgramExerciseError,
  getProgramExerciseListError,
  isProgramExerciseSelectable,
} from '../src/features/training-programs/lib/add-program-exercise.ts';

const id = '00000000-0000-4000-8000-000000000010';

test('exercise picker validates UUID and trimmed optional notes', () => {
  assert.equal(addProgramExerciseSchema.safeParse({ exerciseId: id, notes: '' }).success, true);
  for (const invalid of ['', 'not-a-uuid', '0000']) {
    assert.equal(
      addProgramExerciseSchema.safeParse({ exerciseId: invalid, notes: '' }).success,
      false,
    );
  }
  assert.equal(
    addProgramExerciseSchema.safeParse({ exerciseId: id, notes: 'a'.repeat(5001) }).success,
    false,
  );
});

test('typed program exercise payload trims notes or omits empty notes', () => {
  assert.deepEqual(
    buildAddProgramExercisePayload(
      addProgramExerciseSchema.parse({ exerciseId: id, notes: '  Контроль  ' }),
    ),
    { exerciseId: id, notes: 'Контроль' },
  );
  assert.deepEqual(
    buildAddProgramExercisePayload(addProgramExerciseSchema.parse({ exerciseId: id, notes: '  ' })),
    { exerciseId: id },
  );
});

test('only global and trainer-owned non-archived exercises are selectable once', () => {
  const sample = { id, isArchived: false, source: 'GLOBAL' };
  assert.equal(isProgramExerciseSelectable(sample, []), true);
  assert.equal(isProgramExerciseSelectable({ ...sample, source: 'TRAINER_CUSTOM' }, []), true);
  assert.equal(isProgramExerciseSelectable({ ...sample, source: 'ATHLETE_CUSTOM' }, []), false);
  assert.equal(isProgramExerciseSelectable({ ...sample, isArchived: true }, []), false);
  assert.equal(isProgramExerciseSelectable(sample, [id]), false);
});

test('request errors never reveal raw backend data', () => {
  assert.equal(getAddProgramExerciseError(403), getAddProgramExerciseError(404));
  assert.notEqual(getAddProgramExerciseError(409), getAddProgramExerciseError());
  assert.notEqual(getProgramExerciseListError(429), getProgramExerciseListError());
});

test('workout day renders persisted exercises and uses typed draft-only POST', async () => {
  const base = '../src/features/training-programs/ui/';
  const day = await readFile(new URL(base + 'program-workout-item.tsx', import.meta.url), 'utf8');
  const form = await readFile(
    new URL(base + 'add-program-exercise-form.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL(base + 'training-program-workouts.tsx', import.meta.url),
    'utf8',
  );
  assert.match(day, /workout.exercises.map/);
  assert.match(day, /AddProgramExerciseForm/);
  assert.match(form, /webApi\s*\.GET\('\/exercises'/);
  assert.match(form, /webApi.POST\(/);
  assert.match(form, /zodResolver\(addProgramExerciseSchema\)/);
  assert.match(form, /response.status !== 201/);
  assert.match(list, /editable=\{editable && version.status === 'DRAFT'\}/);
  for (const source of [day, form]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
