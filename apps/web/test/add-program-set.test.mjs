import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import {
  addProgramSetSchema,
  buildAddProgramSetPayload,
  defaultProgramSetValues,
  describeProgramSet,
  getAddProgramSetError,
} from '../src/features/training-programs/lib/add-program-set.ts';

test('set target constraints match API: integer bounds, decimals and RPE precision', () => {
  const example = {
    ...defaultProgramSetValues,
    plannedReps: '8',
    plannedWeightKg: '62.50',
    targetRpe: '8.5',
    restSeconds: '90',
  };
  assert.equal(addProgramSetSchema.safeParse(example).success, true);
  for (const [field, values] of [
    ['plannedReps', ['0', '1001', '1.2', '-1', 'abc']],
    ['plannedWeightKg', ['-1', '1000000', '1.234', 'Infinity']],
    ['plannedDurationSeconds', ['0', '604801', '2.5']],
    ['plannedDistanceMeters', ['-2', '100000000', '1.234']],
    ['restSeconds', ['-1', '86401', '1.2']],
    ['targetRpe', ['0.9', '10.1', '7.55']],
    ['targetRir', ['-1', '11', '2.1']],
  ]) {
    for (const value of values) {
      assert.equal(
        addProgramSetSchema.safeParse({ ...example, [field]: value }).success,
        false,
        field + ': ' + value,
      );
    }
  }
  assert.equal(
    addProgramSetSchema.safeParse({ ...example, notes: 'x'.repeat(5001) }).success,
    false,
  );
});

test('blank values are omitted and numbers/notes are normalized for typed POST', () => {
  const input = addProgramSetSchema.parse({
    ...defaultProgramSetValues,
    setType: 'WARMUP',
    plannedReps: '10',
    plannedWeightKg: '62.50',
    targetRpe: '8.5',
    notes: '  Техніка  ',
  });
  assert.deepEqual(buildAddProgramSetPayload(input), {
    setType: 'WARMUP',
    plannedReps: 10,
    plannedWeightKg: 62.5,
    targetRpe: 8.5,
    notes: 'Техніка',
  });
  assert.deepEqual(buildAddProgramSetPayload(defaultProgramSetValues), { setType: 'WORKING' });
});

test('saved decimal strings are displayed without losing their meaning', () => {
  const description = describeProgramSet({
    setType: 'WORKING',
    plannedReps: 8,
    plannedWeightKg: '62.50',
    plannedDurationSeconds: null,
    plannedDistanceMeters: null,
    restSeconds: 90,
    targetRpe: '8.5',
    targetRir: 2,
  });
  assert.match(description, /Робочий/);
  assert.match(description, /62.50 кг/);
  assert.match(description, /8 повт/);
  assert.match(description, /RPE 8.5/);
  assert.match(description, /RIR 2/);
  assert.equal(getAddProgramSetError(403), getAddProgramSetError(404));
  assert.notEqual(getAddProgramSetError(409), getAddProgramSetError());
});

test('draft-only typed POST is separate from saved set read-only display', async () => {
  const root = '../src/features/training-programs/ui/';
  const parent = await readFile(
    new URL(root + 'program-workout-item.tsx', import.meta.url),
    'utf8',
  );
  const item = await readFile(new URL(root + 'program-exercise-item.tsx', import.meta.url), 'utf8');
  const form = await readFile(new URL(root + 'add-program-set-form.tsx', import.meta.url), 'utf8');
  const mutations = await readFile(
    new URL('../src/features/training-programs/api/program-set-mutations.ts', import.meta.url),
    'utf8',
  );
  const cache = await readFile(
    new URL(
      '../src/features/training-programs/api/program-version-mutation-context.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(parent, /ProgramExerciseItem/);
  assert.match(parent, /editable=\{editable\}/);
  assert.match(item, /exercise.sets/);
  assert.match(item, /key=\{set.id\}/);
  assert.match(item, /\{editable &&/);
  assert.match(form, /useCreateProgramSetMutation\(path\)/);
  assert.match(form, /createMutation.mutateAsync\(buildAddProgramSetPayload\(values\)\)/);
  assert.match(mutations, /webApi.POST\(/);
  assert.match(mutations, /response.status !== 201/);
  assert.match(mutations, /retry: false/);
  assert.match(cache, /useAuthFailure\(\)/);
  assert.match(cache, /queryClient.setQueryData\(queryKey, version\)/);
  assert.match(cache, /refetchType: 'none'/);
  assert.doesNotMatch(form, /webApi.POST|webApi.PATCH|router.replace/);
  assert.match(form, /zodResolver\(addProgramSetSchema\)/);
  assert.match(form, /mutation.isPending/);
  for (const source of [parent, item, form, mutations, cache]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
