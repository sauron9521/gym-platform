import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { trainingProgramQueryKeys } from '../src/features/training-programs/lib/training-program-query-keys.ts';

test('program query keys isolate status filters and pagination', () => {
  assert.deepEqual(trainingProgramQueryKeys.all, ['training-programs']);
  assert.deepEqual(trainingProgramQueryKeys.lists(), ['training-programs', 'list']);
  assert.deepEqual(trainingProgramQueryKeys.list('ALL', 1), [
    'training-programs',
    'list',
    { status: 'ALL', page: 1 },
  ]);
  assert.notDeepEqual(
    trainingProgramQueryKeys.list('ALL', 1),
    trainingProgramQueryKeys.list('DRAFT', 1),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.list('ALL', 1),
    trainingProgramQueryKeys.list('ALL', 2),
  );
});

test('successful trainer program mutations invalidate every list filter and page', async () => {
  const mutations = await readFile(
    new URL('../src/features/training-programs/api/training-program-mutations.ts', import.meta.url),
    'utf8',
  );
  const create = await readFile(
    new URL('../src/features/training-programs/ui/create-training-program-form.tsx', import.meta.url),
    'utf8',
  );
  const editor = await readFile(
    new URL('../src/features/training-programs/ui/edit-training-program-draft-form.tsx', import.meta.url),
    'utf8',
  );
  assert.match(mutations, /useCreateTrainingProgramMutation/);
  assert.match(mutations, /useUpdateTrainingProgramDraftMutation/);
  assert.match(mutations, /trainingProgramQueryKeys.lists\(\)/);
  assert.match(mutations, /queryClient.invalidateQueries/);
  assert.match(mutations, /queryClient.setQueryData/);
  assert.match(mutations, /trainingProgramQueryKeys.detail\(programId\)/);
  assert.match(mutations, /item.id === version.id \? version : item/);
  assert.match(mutations, /trainingProgramQueryKeys.version\(programId, versionId\)/);
  assert.match(mutations, /refetchType: 'none'/);
  assert.match(create, /mutation.mutateAsync\(values\)/);
  assert.match(editor, /mutation.mutateAsync\(values\)/);
  assert.doesNotMatch(create + editor + mutations, /localStorage|sessionStorage/);
});

test('program detail cache keys distinguish program IDs from trainer lists', () => {
  assert.deepEqual(trainingProgramQueryKeys.details(), ['training-programs', 'detail']);
  assert.deepEqual(trainingProgramQueryKeys.detail('program-1'), [
    'training-programs',
    'detail',
    'program-1',
  ]);
  assert.notDeepEqual(
    trainingProgramQueryKeys.detail('program-1'),
    trainingProgramQueryKeys.detail('program-2'),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.detail('program-1'),
    trainingProgramQueryKeys.list('ALL', 1),
  );
});

test('draft editor updates only the matching cached program without parent callbacks', async () => {
  const editor = await readFile(
    new URL(
      '../src/features/training-programs/ui/edit-training-program-draft-form.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const detail = await readFile(
    new URL('../src/features/training-programs/ui/trainer-program-details.tsx', import.meta.url),
    'utf8',
  );
  const mutations = await readFile(
    new URL('../src/features/training-programs/api/training-program-mutations.ts', import.meta.url),
    'utf8',
  );
  assert.match(editor, /form.reset\(toTrainingProgramDraftValues\(updated\)\)/);
  assert.match(mutations, /queryClient.setQueryData/);
  assert.match(mutations, /trainingProgramQueryKeys.detail\(programId\)/);
  assert.match(mutations, /item.id === version.id \? version : item/);
  assert.match(detail, /<EditTrainingProgramDraftForm/);
  assert.doesNotMatch(detail, /onUpdated=\{onUpdated\}/);
});

test('athlete assignment keys separate status, page and trainer-owned program data', () => {
  assert.deepEqual(trainingProgramQueryKeys.assignments(), ['training-programs', 'assignments']);
  assert.deepEqual(trainingProgramQueryKeys.assignmentList('ALL', 1), [
    'training-programs',
    'assignments',
    { status: 'ALL', page: 1 },
  ]);
  assert.notDeepEqual(
    trainingProgramQueryKeys.assignmentList('ALL', 1),
    trainingProgramQueryKeys.assignmentList('ACTIVE', 1),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.assignmentList('ACTIVE', 1),
    trainingProgramQueryKeys.assignmentList('ACTIVE', 2),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.assignmentList('ALL', 1),
    trainingProgramQueryKeys.list('ALL', 1),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.assignmentList('ALL', 1),
    trainingProgramQueryKeys.detail('program-1'),
  );
});

test('workout version keys isolate programs, versions, details and athlete assignments', () => {
  assert.deepEqual(trainingProgramQueryKeys.versions(), ['training-programs', 'version']);
  assert.deepEqual(trainingProgramQueryKeys.version('program-1', 'version-1'), [
    'training-programs',
    'version',
    'program-1',
    'version-1',
  ]);
  assert.notDeepEqual(
    trainingProgramQueryKeys.version('program-1', 'version-1'),
    trainingProgramQueryKeys.version('program-1', 'version-2'),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.version('program-1', 'version-1'),
    trainingProgramQueryKeys.version('program-2', 'version-1'),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.version('program-1', 'version-1'),
    trainingProgramQueryKeys.detail('program-1'),
  );
  assert.notDeepEqual(
    trainingProgramQueryKeys.version('program-1', 'version-1'),
    trainingProgramQueryKeys.assignmentList('ALL', 1),
  );
});

test('workout and nested exercise/set mutations share the version write-through cache', async () => {
  const parent = await readFile(
    new URL('../src/features/training-programs/ui/training-program-workouts.tsx', import.meta.url),
    'utf8',
  );
  assert.match(parent, /queryClient.setQueryData/);
  assert.match(parent, /trainingProgramQueryKeys.version\(programId, versionId\)/);
  assert.match(parent, /onChanged=\{/);
  assert.match(parent, /onCreated=\{/);

  for (const path of [
    '../src/features/training-programs/ui/program-workout-item.tsx',
    '../src/features/training-programs/ui/program-exercise-item.tsx',
    '../src/features/training-programs/ui/program-set-item.tsx',
  ]) {
    const child = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(child, /onChanged/);
  }
});
