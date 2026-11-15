import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

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

test('exercise mutations invalidate list cache only after a successful response', async () => {
  for (const path of [
    '../src/features/exercises/ui/create-exercise-form.tsx',
    '../src/features/exercises/ui/edit-exercise-form.tsx',
    '../src/features/exercises/ui/exercise-details.tsx',
  ]) {
    const content = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(content, /useQueryClient/);
    assert.match(content, /queryClient\.invalidateQueries/);
    assert.match(content, /exerciseQueryKeys\.lists\(\)/);
  }
});

test('detail keys isolate exercise IDs and taxonomy never aliases a private list', () => {
  assert.deepEqual(exerciseQueryKeys.details(), ['exercises', 'detail']);
  assert.deepEqual(exerciseQueryKeys.detail('exercise-1'), ['exercises', 'detail', 'exercise-1']);
  assert.deepEqual(exerciseQueryKeys.taxonomy(), ['exercises', 'taxonomy']);
  assert.notDeepEqual(exerciseQueryKeys.detail('exercise-1'), exerciseQueryKeys.detail('exercise-2'));
  assert.notDeepEqual(exerciseQueryKeys.detail('exercise-1'), exerciseQueryKeys.list(filters));
  assert.notDeepEqual(exerciseQueryKeys.taxonomy(), exerciseQueryKeys.lists());
});

test('successful edits sync detail cache and archive invalidates the detail ID', async () => {
  const details = await readFile(
    new URL('../src/features/exercises/ui/exercise-details.tsx', import.meta.url),
    'utf8',
  );
  assert.match(details, /queryClient.setQueryData/);
  assert.match(details, /exerciseQueryKeys.detail\(id\)/);
  assert.match(details, /refetchType: 'none'/);
  assert.match(details, /queryClient.invalidateQueries/);
});
