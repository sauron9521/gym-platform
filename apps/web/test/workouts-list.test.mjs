import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  formatWorkoutDate,
  getWorkoutListErrorMessage,
  getWorkoutPageCount,
  getWorkoutStatusLabel,
  WORKOUT_FILTERS,
} from '../src/features/workouts/lib/workouts-list.ts';

test('workout filters cover all API statuses with clear labels', () => {
  assert.deepEqual(
    WORKOUT_FILTERS.map((item) => item.value),
    ['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  );
  assert.equal(getWorkoutStatusLabel('PLANNED'), 'Заплановано');
  assert.equal(getWorkoutStatusLabel('IN_PROGRESS'), 'У процесі');
  assert.equal(getWorkoutStatusLabel('COMPLETED'), 'Завершено');
  assert.equal(getWorkoutStatusLabel('CANCELLED'), 'Скасовано');
});

test('date and pagination helpers handle missing and invalid data', () => {
  assert.equal(formatWorkoutDate(null), 'Не заплановано');
  assert.equal(formatWorkoutDate('invalid-date'), 'Дата недоступна');
  assert.match(formatWorkoutDate('2026-11-14T08:00:00Z'), /2026/);
  assert.equal(getWorkoutPageCount(0), 1);
  assert.equal(getWorkoutPageCount(-1), 1);
  assert.equal(getWorkoutPageCount(4), 4);
  assert.equal(getWorkoutPageCount(Number.NaN), 1);
});

test('workout fetch errors do not expose backend response bodies', () => {
  assert.match(getWorkoutListErrorMessage(403), /дозволу/);
  assert.match(getWorkoutListErrorMessage(429), /Забагато/);
  assert.match(getWorkoutListErrorMessage(500), /Спробуйте/);
  assert.equal(getWorkoutListErrorMessage(), getWorkoutListErrorMessage(502));
});

test('workouts route has independent server guard and typed summary API request', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/workouts/page.tsx', import.meta.url),
    'utf8',
  );
  const ui = await readFile(
    new URL('../src/features/workouts/ui/workouts-list.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(ui, /webApi\s*\.GET\('\/workouts'/);
  assert.match(ui, /view: 'summary'/);
  assert.match(ui, /response.status === 401/);
  assert.match(ui, /router.replace\('\/login'\)/);
  assert.match(ui, /if \(!active\) return/);
  assert.match(ui, /<nav aria-label="Сторінки тренувань"/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document.cookie|dangerouslySetInnerHTML/);
});
