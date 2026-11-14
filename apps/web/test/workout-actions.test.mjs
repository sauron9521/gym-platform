import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  availableWorkoutActions,
  canCompleteWorkout,
  getWorkoutActionErrorMessage,
  WORKOUT_ACTION_LABELS,
} from '../src/features/workouts/lib/workout-actions.ts';

const makeWorkout = (status, sets = []) => ({
  id: 'workout-1',
  status,
  exercises: [{ sets: sets.map((status) => ({ status })) }],
});

test('only planned workouts can start and active workouts can cancel', () => {
  assert.deepEqual(availableWorkoutActions(makeWorkout('PLANNED')), ['start', 'cancel']);
  assert.deepEqual(availableWorkoutActions(makeWorkout('IN_PROGRESS')), ['cancel']);
  assert.deepEqual(availableWorkoutActions(makeWorkout('COMPLETED')), []);
  assert.deepEqual(availableWorkoutActions(makeWorkout('CANCELLED')), []);
});

test('completion needs processed sets and at least one completed set', () => {
  assert.equal(canCompleteWorkout(makeWorkout('IN_PROGRESS', [])), false);
  assert.equal(canCompleteWorkout(makeWorkout('IN_PROGRESS', ['SKIPPED'])), false);
  assert.equal(canCompleteWorkout(makeWorkout('IN_PROGRESS', ['COMPLETED', 'PENDING'])), false);
  assert.equal(canCompleteWorkout(makeWorkout('PLANNED', ['COMPLETED'])), false);
  assert.equal(canCompleteWorkout(makeWorkout('IN_PROGRESS', ['COMPLETED', 'SKIPPED'])), true);
  assert.deepEqual(availableWorkoutActions(makeWorkout('IN_PROGRESS', ['COMPLETED'])), [
    'complete',
    'cancel',
  ]);
});

test('actions use safe messages and Ukrainian labels', () => {
  assert.equal(getWorkoutActionErrorMessage(403), getWorkoutActionErrorMessage(404));
  assert.equal(getWorkoutActionErrorMessage(400), getWorkoutActionErrorMessage(409));
  assert.equal(getWorkoutActionErrorMessage(), getWorkoutActionErrorMessage(500));
  assert.match(WORKOUT_ACTION_LABELS.complete, /Завершити/);
});

test('workout lifecycle controls use typed endpoints and inline confirmations', async () => {
  const ui = await readFile(
    new URL('../src/features/workouts/ui/workout-actions.tsx', import.meta.url),
    'utf8',
  );
  const details = await readFile(
    new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
    'utf8',
  );
  for (const action of ['start', 'complete', 'cancel']) {
    assert.ok(ui.includes(`webApi.POST('/workouts/{id}/${action}'`));
  }
  assert.match(ui, /response.status === 401/);
  assert.match(ui, /router.replace\('\/login'\)/);
  assert.match(ui, /disabled=\{inProgress\}/);
  assert.match(ui, /setConfirmation/);
  assert.match(details, /<WorkoutActions/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|window.confirm|dangerouslySetInnerHTML/);
});
