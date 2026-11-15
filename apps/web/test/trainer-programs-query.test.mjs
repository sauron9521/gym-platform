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

test('successful trainer program creation and draft edits invalidate all list variants', async () => {
  for (const path of [
    '../src/features/training-programs/ui/create-training-program-form.tsx',
    '../src/features/training-programs/ui/edit-training-program-draft-form.tsx',
  ]) {
    const form = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(form, /useQueryClient/);
    assert.match(form, /queryClient.invalidateQueries/);
    assert.match(form, /trainingProgramQueryKeys.lists\(\)/);
    assert.doesNotMatch(form, /localStorage|sessionStorage/);
  }
});
