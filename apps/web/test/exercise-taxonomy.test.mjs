import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { getTaxonomyErrorMessage } from '../src/features/exercises/lib/exercise-taxonomy.ts';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('taxonomy errors are safe and rate limits offer a useful retry message', () => {
  assert.equal(getTaxonomyErrorMessage(), getTaxonomyErrorMessage(500));
  assert.notEqual(getTaxonomyErrorMessage(429), getTaxonomyErrorMessage(500));
});

test('taxonomy hook reads both typed routes, prevents stale updates and retries', async () => {
  const hook = await source('../src/features/exercises/ui/use-exercise-taxonomy.ts');
  assert.match(hook, /webApi.GET\('\/exercises\/muscle-groups'\)/);
  assert.match(hook, /webApi.GET\('\/exercises\/equipment'\)/);
  assert.match(hook, /Promise.all/);
  assert.match(hook, /active = false/);
  assert.match(hook, /response.status === 401/);
  assert.match(hook, /router.replace\('\/login'\)/);
  assert.match(hook, /setAttempt/);
  assert.doesNotMatch(hook, /localStorage|sessionStorage/);
});

test('create and edit forms use API-backed choices and disable submission on errors', async () => {
  for (const path of [
    '../src/features/exercises/ui/create-exercise-form.tsx',
    '../src/features/exercises/ui/edit-exercise-form.tsx',
  ]) {
    const ui = await source(path);
    assert.match(ui, /useExerciseTaxonomy/);
    assert.match(ui, /taxonomy.kind === 'ready'/);
    assert.match(ui, /retryTaxonomy/);
    assert.match(ui, /muscleOptions.map/);
    assert.match(ui, /equipmentOptions.map/);
    assert.doesNotMatch(ui, /MUSCLE_OPTIONS|EQUIPMENT_OPTIONS/);
  }
  const schema = await source('../src/features/exercises/lib/create-exercise.ts');
  assert.doesNotMatch(schema, /MUSCLE_OPTIONS|EQUIPMENT_OPTIONS/);
  assert.match(schema, /М’язові групи не повинні повторюватися/);
});

test('catalog uses dropdowns from live taxonomy rather than editable slug strings', async () => {
  const ui = await source('../src/features/exercises/ui/exercise-catalog.tsx');
  assert.match(ui, /useExerciseTaxonomy/);
  assert.match(ui, /taxonomy.muscleGroups.map/);
  assert.match(ui, /taxonomy.equipment.map/);
  assert.match(ui, /value=\{item.slug\}/);
  assert.match(ui, /retryTaxonomy/);
  assert.doesNotMatch(ui, /placeholder="Наприклад: chest"/);
  assert.doesNotMatch(ui, /placeholder="Наприклад: barbell"/);
});

test('API taxonomy endpoints specify minimal OpenAPI responses', async () => {
  const controller = await source(
    '../../api/src/modules/exercises/controllers/exercises.controller.ts',
  );
  const contracts = await source(
    '../../api/src/infra/openapi/response-contracts.ts',
  );
  assert.match(controller, /@Get\('muscle-groups'\)/);
  assert.match(controller, /@Get\('equipment'\)/);
  assert.match(controller, /exerciseTaxonomyListResponseSchema/);
  assert.match(contracts, /arraySchema\(namedReference\)/);
});
