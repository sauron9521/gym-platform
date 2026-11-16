import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import {
  exerciseQueryKeys,
  normalizeExerciseCatalogFilters,
} from '../src/features/exercises/lib/exercise-query-keys.ts';

const filters = {
  search: '',
  exerciseType: 'ALL',
  muscleGroup: '',
  equipment: '',
  page: 1,
};

test('exercise list keys include every filter, the page and the list namespace', () => {
  assert.deepEqual(exerciseQueryKeys.all, ['exercises']);
  assert.deepEqual(exerciseQueryKeys.lists(), ['exercises', 'list']);
  assert.deepEqual(exerciseQueryKeys.list(filters), ['exercises', 'list', filters]);

  for (const change of [
    { search: 'bench' },
    { exerciseType: 'STRENGTH' },
    { muscleGroup: 'chest' },
    { equipment: 'barbell' },
    { page: 2 },
  ]) {
    assert.notDeepEqual(
      exerciseQueryKeys.list(filters),
      exerciseQueryKeys.list({ ...filters, ...change }),
    );
  }
});

test('query keys normalize whitespace so equivalent filters share one cache entry', () => {
  const normalized = normalizeExerciseCatalogFilters({
    ...filters,
    search: '  bench ',
    muscleGroup: ' chest ',
    equipment: '  barbell  ',
  });
  assert.deepEqual(normalized, {
    ...filters,
    search: 'bench',
    muscleGroup: 'chest',
    equipment: 'barbell',
  });

  assert.deepEqual(
    exerciseQueryKeys.list({ ...filters, search: '  bench ' }),
    exerciseQueryKeys.list({ ...filters, search: 'bench' }),
  );
});

test('exercise write hooks invalidate the shared list cache only after successful responses', async () => {
  const mutation = await readFile(
    new URL('../src/features/exercises/api/exercise-mutations.ts', import.meta.url),
    'utf8',
  );
  assert.match(mutation, /useQueryClient/);
  assert.match(mutation, /queryClient\.invalidateQueries/);
  assert.match(mutation, /exerciseQueryKeys\.lists\(\)/);
  assert.match(mutation, /onSuccess: invalidateLists/);
  assert.match(mutation, /onSuccess: updateDetails/);
  assert.match(mutation, /retry: false/);

  for (const [path, hook] of [
    ['../src/features/exercises/ui/create-exercise-form.tsx', 'useCreateExerciseMutation'],
    ['../src/features/exercises/ui/edit-exercise-form.tsx', 'useEditExerciseMutation'],
    ['../src/features/exercises/ui/exercise-details.tsx', 'useArchiveExerciseMutation'],
  ]) {
    const content = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.ok(content.includes(hook));
    assert.doesNotMatch(content, /webApi\.(?:POST|PATCH|DELETE)/);
  }
});

test('detail keys isolate exercise IDs and taxonomy never aliases a private list', () => {
  assert.deepEqual(exerciseQueryKeys.details(), ['exercises', 'detail']);
  assert.deepEqual(exerciseQueryKeys.detail('exercise-1'), ['exercises', 'detail', 'exercise-1']);
  assert.deepEqual(exerciseQueryKeys.taxonomy(), ['exercises', 'taxonomy']);
  assert.notDeepEqual(
    exerciseQueryKeys.detail('exercise-1'),
    exerciseQueryKeys.detail('exercise-2'),
  );
  assert.notDeepEqual(exerciseQueryKeys.detail('exercise-1'), exerciseQueryKeys.list(filters));
  assert.notDeepEqual(exerciseQueryKeys.taxonomy(), exerciseQueryKeys.lists());
});

test('successful edits sync detail cache and archiving evicts its private entry', async () => {
  const mutations = await readFile(
    new URL('../src/features/exercises/api/exercise-mutations.ts', import.meta.url),
    'utf8',
  );
  const details = await readFile(
    new URL('../src/features/exercises/ui/exercise-details.tsx', import.meta.url),
    'utf8',
  );
  assert.match(mutations, /queryClient\.setQueryData\(queryKey, exercise\)/);
  assert.match(mutations, /exerciseQueryKeys\.detail\(exercise.id\)/);
  assert.match(mutations, /queryClient\.removeQueries/);
  assert.match(mutations, /exerciseQueryKeys\.detail\(id\)/);
  assert.match(mutations, /refetchType: 'none'/);
  assert.match(details, /useArchiveExerciseMutation\(id\)/);
  assert.doesNotMatch(details, /queryClient\.setQueryData/);
});
