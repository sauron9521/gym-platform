import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  EXERCISE_TYPES,
  getExerciseDetailsErrorMessage,
  getExerciseErrorMessage,
  getExercisePageCount,
  getExerciseSourceLabel,
  getExerciseTypeLabel,
} from '../src/features/exercises/lib/exercise-catalog.ts';

test('exercise filters cover all supported API exercise types', () => {
  assert.deepEqual(
    EXERCISE_TYPES.map((option) => option.value),
    ['ALL', 'STRENGTH', 'CARDIO', 'MOBILITY', 'PLYOMETRIC', 'OTHER'],
  );
  assert.equal(getExerciseTypeLabel('STRENGTH'), 'Силова');
  assert.equal(getExerciseTypeLabel('MOBILITY'), 'Мобільність');
});

test('exercise source labels distinguish public, private and trainer library', () => {
  assert.equal(getExerciseSourceLabel('GLOBAL'), 'Загальна бібліотека');
  assert.match(getExerciseSourceLabel('ATHLETE_CUSTOM'), /Власна/);
  assert.match(getExerciseSourceLabel('TRAINER_CUSTOM'), /тренера/);
});

test('catalog pagination normalizes invalid metadata without inventing pages', () => {
  assert.equal(getExercisePageCount(0), 1);
  assert.equal(getExercisePageCount(-2), 1);
  assert.equal(getExercisePageCount(Number.NaN), 1);
  assert.equal(getExercisePageCount(2.5), 1);
  assert.equal(getExercisePageCount(8), 8);
});

test('exercise errors avoid exposing backend bodies and preserve access distinctions', () => {
  assert.equal(getExerciseErrorMessage(), getExerciseErrorMessage(500));
  assert.notEqual(getExerciseErrorMessage(429), getExerciseErrorMessage(400));
  assert.equal(getExerciseDetailsErrorMessage(403), getExerciseDetailsErrorMessage(404));
  assert.notEqual(getExerciseDetailsErrorMessage(429), getExerciseDetailsErrorMessage(404));
});

test('catalog and detail routes independently guard the user session', async () => {
  for (const path of [
    '../src/app/(protected)/exercises/page.tsx',
    '../src/app/(protected)/exercises/[id]/page.tsx',
  ]) {
    const page = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(page, /verifyServerSession/);
    assert.match(page, /session.kind === 'unauthenticated'/);
    assert.match(page, /session.kind === 'forbidden'/);
    assert.match(page, /session.kind === 'unavailable'/);
    assert.match(page, /redirect\('\/login'\)/);
    assert.match(page, /robots: \{ index: false \}/);
  }
});

test('catalog uses TanStack Query with filters, pagination, retries and private-data protection', async () => {
  const catalog = await readFile(
    new URL('../src/features/exercises/ui/exercise-catalog.tsx', import.meta.url),
    'utf8',
  );
  const api = await readFile(
    new URL('../src/features/exercises/api/exercise-list-query.ts', import.meta.url),
    'utf8',
  );

  assert.match(catalog, /useQuery\(/);
  assert.match(catalog, /exerciseListQueryOptions/);
  assert.match(catalog, /setDebouncedSearch/);
  assert.match(catalog, /setTimeout/);
  assert.match(catalog, /clearTimeout/);
  assert.match(catalog, /enabled: !searching/);
  assert.match(catalog, /query\.refetch\(/);
  assert.match(catalog, /router\.replace\('\/login'\)/);
  assert.match(catalog, /queryClient\.clear\(\)/);
  assert.match(catalog, /href=\{/);

  assert.match(api, /webApi\.GET\('\/exercises'/);
  assert.match(api, /queryOptions\(/);
  assert.match(api, /signal,/);
  assert.match(api, /!exercise\.isArchived/);
  assert.match(api, /data\.meta\.totalPages/);
  for (const field of ['search', 'exerciseType', 'muscleGroup', 'equipment', 'page', 'limit']) {
    assert.ok(api.includes(field));
  }
  assert.doesNotMatch(catalog + api, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test('exercise details handle inaccessible and archived records', async () => {
  const details = await readFile(
    new URL('../src/features/exercises/ui/exercise-details.tsx', import.meta.url),
    'utf8',
  );
  assert.match(details, /\.GET\('\/exercises\/\{id\}'/);
  assert.match(details, /response.status === 401/);
  assert.match(details, /response.status !== 200/);
  assert.match(details, /data\.isArchived/);
  assert.match(details, /state\.exercise\.instructions/);
  assert.match(details, /state\.exercise\.muscleGroups/);
  assert.match(details, /state\.exercise\.equipment/);
  assert.match(details, /href="\/workouts\/new"/);
  assert.doesNotMatch(details, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test('protected navigation links to exercise catalog', async () => {
  const nav = await readFile(new URL('../src/app/(protected)/layout.tsx', import.meta.url), 'utf8');
  assert.match(nav, /href="\/exercises"/);
});
