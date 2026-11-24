import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  workoutStatuses,
  canCompleteWorkout,
  canTransitionWorkout,
  workoutSetProgress,
} from '@gym/domain';

test('only planned and in-progress workouts have valid outgoing transitions', () => {
  assert.deepEqual(workoutStatuses, ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
  assert.equal(canTransitionWorkout('PLANNED', 'IN_PROGRESS'), true);
  assert.equal(canTransitionWorkout('PLANNED', 'CANCELLED'), true);
  assert.equal(canTransitionWorkout('IN_PROGRESS', 'COMPLETED'), true);
  assert.equal(canTransitionWorkout('IN_PROGRESS', 'CANCELLED'), true);
  assert.equal(canTransitionWorkout('PLANNED', 'COMPLETED'), false);
  for (const terminal of ['COMPLETED', 'CANCELLED']) {
    for (const target of workoutStatuses) {
      assert.equal(canTransitionWorkout(terminal, target), false);
    }
  }
});

test('completion requires an existing completed set and no pending sets', () => {
  assert.equal(canCompleteWorkout([]), false);
  assert.equal(canCompleteWorkout([{ status: 'SKIPPED' }]), false);
  assert.equal(canCompleteWorkout([{ status: 'COMPLETED' }, { status: 'PENDING' }]), false);
  assert.equal(canCompleteWorkout([{ status: 'COMPLETED' }]), true);
  assert.equal(canCompleteWorkout([{ status: 'COMPLETED' }, { status: 'SKIPPED' }]), true);
});

test('status progress includes skipped sets without counting them as completed', () => {
  assert.deepEqual(
    workoutSetProgress([{ status: 'PENDING' }, { status: 'COMPLETED' }, { status: 'SKIPPED' }]),
    { completed: 1, skipped: 1, pending: 1, total: 3 },
  );
});
