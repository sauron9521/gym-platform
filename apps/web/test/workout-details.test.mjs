import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  formatWorkoutValue,
  getWorkoutDetailsErrorMessage,
  getWorkoutSetStatusLabel,
  getWorkoutSetTypeLabel,
} from '../src/features/workouts/lib/workout-details.ts';

test('workout detail error messages protect backend information', () => {
  assert.equal(getWorkoutDetailsErrorMessage(403), getWorkoutDetailsErrorMessage(404));
  assert.match(getWorkoutDetailsErrorMessage(400), /ідентифікатор/);
  assert.match(getWorkoutDetailsErrorMessage(429), /Забагато/);
  assert.equal(getWorkoutDetailsErrorMessage(), getWorkoutDetailsErrorMessage(500));
});

test('workout set labels and decimal values format safely', () => {
  assert.equal(getWorkoutSetStatusLabel('COMPLETED'), 'Виконано');
  assert.equal(getWorkoutSetStatusLabel('SKIPPED'), 'Пропущено');
  assert.equal(getWorkoutSetTypeLabel('WARMUP'), 'Розминка');
  assert.equal(getWorkoutSetTypeLabel('WORKING'), 'Робочий');
  assert.equal(formatWorkoutValue(null, ' кг'), '—');
  assert.match(formatWorkoutValue('21.50', ' кг'), /21,5 кг/);
  assert.equal(formatWorkoutValue('invalid'), '—');
});

test('workout detail route enforces session, and client uses typed cookie API', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/workouts/[id]/page.tsx', import.meta.url),
    'utf8',
  );
  const ui = await readFile(
    new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL('../src/features/workouts/ui/workouts-list.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(ui, /webApi\s*\.GET\('\/workouts\/\{id\}'/);
  assert.match(ui, /response.status === 401/);
  assert.match(ui, /router.replace\('\/login'\)/);
  assert.match(ui, /if \(!active\) return/);
  assert.match(list, /href=\{\`\/workouts\/\$\{workout.id\}\`\}/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document.cookie|dangerouslySetInnerHTML/);
});
