import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import { addProgramSetSchema } from '../src/features/training-programs/lib/add-program-set.ts';
import {
  buildUpdateProgramSetPayload,
  defaultEditProgramSetValues,
  editProgramSetSchema,
  getProgramSetMutationError,
} from '../src/features/training-programs/lib/edit-program-set.ts';

const saved = {
  id: '00000000-0000-4000-8000-000000000001',
  setNumber: 1,
  setType: 'WORKING',
  plannedReps: 10,
  plannedWeightKg: '62.50',
  plannedDurationSeconds: null,
  plannedDistanceMeters: null,
  restSeconds: 90,
  targetRpe: '8.5',
  targetRir: 2,
  notes: 'Before editing',
};

test('editing uses the same Zod validation as creation', () => {
  assert.equal(editProgramSetSchema, addProgramSetSchema);
  const values = defaultEditProgramSetValues(saved);
  assert.equal(editProgramSetSchema.safeParse(values).success, true);
  assert.equal(values.plannedReps, '10');
  assert.equal(values.plannedWeightKg, '62.50');
  assert.equal(values.targetRpe, '8.5');
  for (const invalid of ['0', '1001', '1.5']) {
    assert.equal(
      editProgramSetSchema.safeParse({ ...values, plannedReps: invalid }).success,
      false,
    );
  }
});

test('PATCH sends all targets and explicitly clears omitted values and notes', () => {
  const values = editProgramSetSchema.parse({
    ...defaultEditProgramSetValues(saved),
    setType: 'DROP_SET',
    plannedReps: '8',
    plannedWeightKg: '70.25',
    restSeconds: '',
    targetRpe: '',
    targetRir: '',
    notes: '  ',
  });
  assert.deepEqual(buildUpdateProgramSetPayload(values), {
    setType: 'DROP_SET',
    plannedReps: 8,
    plannedWeightKg: 70.25,
    plannedDurationSeconds: null,
    plannedDistanceMeters: null,
    restSeconds: null,
    targetRpe: null,
    targetRir: null,
    notes: null,
  });
});

test('editable empty fields preserve zero targets but can clear values with null', () => {
  const values = defaultEditProgramSetValues({
    ...saved,
    plannedReps: null,
    plannedWeightKg: '0',
    plannedDistanceMeters: '0.00',
    restSeconds: 0,
    notes: null,
  });
  assert.equal(values.plannedReps, '');
  assert.equal(values.plannedWeightKg, '0');
  assert.equal(values.restSeconds, '0');
  assert.equal(values.notes, '');
  assert.equal(values.plannedDistanceMeters, '0.00');
  const payload = buildUpdateProgramSetPayload(editProgramSetSchema.parse(values));
  assert.equal(payload.plannedReps, null);
  assert.equal(payload.plannedWeightKg, 0);
  assert.equal(payload.restSeconds, 0);
});

test('mutation errors are status-based and do not leak raw backend content', () => {
  assert.equal(getProgramSetMutationError('edit', 403), getProgramSetMutationError('edit', 404));
  assert.notEqual(getProgramSetMutationError('edit', 409), getProgramSetMutationError('edit'));
  assert.notEqual(getProgramSetMutationError('delete'), getProgramSetMutationError('edit'));
});

test('draft-only controls, typed PATCH/DELETE and confirmed deletion', async () => {
  const root = '../src/features/training-programs/ui/';
  const parent = await readFile(
    new URL(root + 'program-exercise-item.tsx', import.meta.url),
    'utf8',
  );
  const item = await readFile(new URL(root + 'program-set-item.tsx', import.meta.url), 'utf8');
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
  assert.match(parent, /editable=\{editable\}/);
  assert.match(item, /\{editable &&/);
  assert.match(item, /confirmDelete &&/);
  assert.match(item, /if \(!confirmDelete \|\| deleteMutation.isPending \|\| !editable\) return/);
  assert.match(item, /useDeleteProgramSetMutation\(\{/);
  assert.match(item, /deleteMutation.mutateAsync\(set.id\)/);
  assert.match(mutations, /webApi.DELETE\(/);
  assert.match(mutations, /webApi.PATCH\(/);
  assert.match(mutations, /onSuccess: updateVersion/);
  assert.match(mutations, /retry: false/);
  assert.match(cache, /useAuthFailure\(\)/);
  assert.doesNotMatch(item + form, /webApi.DELETE|webApi.PATCH|router.replace/);
  assert.match(mutations, /response.status !== 200/);
  assert.match(form, /useUpdateProgramSetMutation\(path\)/);
  assert.match(form, /updateMutation.mutateAsync\(\{/);
  assert.match(form, /mutation.isPending/);
  assert.match(form, /zodResolver\(addProgramSetSchema\)/);
  for (const source of [parent, item, form, mutations, cache]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
