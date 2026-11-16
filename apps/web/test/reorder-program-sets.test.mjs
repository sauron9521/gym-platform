import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import {
  buildReorderProgramSetsPayload,
  getReorderProgramSetsError,
  sortProgramSets,
} from '../src/features/training-programs/lib/reorder-program-sets.ts';

const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const c = '00000000-0000-4000-8000-000000000003';

const sets = [
  { id: c, setNumber: 3 },
  { id: a, setNumber: 1 },
  { id: b, setNumber: 2 },
];

test('full permutation swaps adjacent saved IDs without mutating source data', () => {
  const before = structuredClone(sets);
  assert.deepEqual(
    sortProgramSets(sets).map((set) => set.id),
    [a, b, c],
  );
  assert.deepEqual(buildReorderProgramSetsPayload(sets, b, 'up'), {
    setIds: [b, a, c],
  });
  assert.deepEqual(buildReorderProgramSetsPayload(sets, b, 'down'), {
    setIds: [a, c, b],
  });
  assert.deepEqual(sets, before);
});

test('no request payload for the first/last boundary or unknown set', () => {
  assert.equal(buildReorderProgramSetsPayload(sets, a, 'up'), null);
  assert.equal(buildReorderProgramSetsPayload(sets, c, 'down'), null);
  assert.equal(buildReorderProgramSetsPayload(sets, 'missing', 'up'), null);
  assert.equal(buildReorderProgramSetsPayload([], a, 'down'), null);
  assert.equal(buildReorderProgramSetsPayload([sets[0]], c, 'down'), null);
});

test('reject duplicate IDs and more than 100 sets before sending to the backend', () => {
  assert.equal(buildReorderProgramSetsPayload([sets[0], sets[0]], c, 'up'), null);
  const overLimit = Array.from({ length: 101 }, (_, index) => ({
    id: `set-${index}`,
    setNumber: index + 1,
  }));
  assert.equal(buildReorderProgramSetsPayload(overLimit, 'set-1', 'up'), null);
});

test('HTTP status errors are safe and explain conflict or permissions', () => {
  assert.equal(getReorderProgramSetsError(403), getReorderProgramSetsError(404));
  assert.notEqual(getReorderProgramSetsError(400), getReorderProgramSetsError(409));
  assert.notEqual(getReorderProgramSetsError(429), getReorderProgramSetsError());
});

test('draft-only controls persist the full typed order and disable while pending', async () => {
  const root = '../src/features/training-programs/ui/';
  const exercise = await readFile(
    new URL(root + 'program-exercise-item.tsx', import.meta.url),
    'utf8',
  );
  const item = await readFile(new URL(root + 'program-set-item.tsx', import.meta.url), 'utf8');
  const parent = await readFile(
    new URL(root + 'training-program-workouts.tsx', import.meta.url),
    'utf8',
  );
  const mutations = await readFile(
    new URL('../src/features/training-programs/api/program-set-mutations.ts', import.meta.url),
    'utf8',
  );
  assert.match(parent, /editable=\{editable && version.status === 'DRAFT'\}/);
  assert.match(exercise, /useReorderProgramSetsMutation\(\{/);
  assert.match(exercise, /reorderMutation.mutateAsync\(payload\)/);
  assert.match(mutations, /webApi.PATCH\(/);
  assert.match(mutations, /sets\/reorder'/);
  assert.match(mutations, /retry: false/);
  assert.doesNotMatch(exercise, /webApi.PATCH|router.replace/);
  assert.match(exercise, /buildReorderProgramSetsPayload/);
  assert.match(mutations, /response.status !== 200/);
  assert.match(exercise, /moveDisabled=\{reorderMutation.isPending/);
  assert.match(item, /disabled=\{moveDisabled \|\| !canMoveUp\}/);
  assert.match(item, /disabled=\{moveDisabled \|\| !canMoveDown\}/);
  assert.match(item, /\{editable &&/);
  for (const source of [exercise, item, mutations]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
