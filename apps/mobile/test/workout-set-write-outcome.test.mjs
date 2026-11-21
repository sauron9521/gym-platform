import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  isUncertainWorkoutSetResponse,
  WorkoutSetOutcomeUnknownError,
} from '../src/features/workouts/lib/workout-set-write-outcome.ts';

test('lost write response or unknown server outcome must not be interpreted as a definite rejection', () => {
  for (const status of [0, 408, 500, 502, 503, 504]) {
    assert.equal(isUncertainWorkoutSetResponse(status, false), true);
  }
  assert.equal(isUncertainWorkoutSetResponse(200, false), true);
  assert.equal(isUncertainWorkoutSetResponse(200, true), false);
});

test('known rejected writes do not require ambiguous-write reconciliation', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    assert.equal(isUncertainWorkoutSetResponse(status, false), false);
  }
});

test('unknown outcome error never claims the server rejected or confirmed a PATCH', () => {
  const error = new WorkoutSetOutcomeUnknownError();
  assert.equal(error.name, 'WorkoutSetOutcomeUnknownError');
  assert.equal(error.canonicalStateVerified, false);
  assert.doesNotMatch(error.message, /not saved|не збережено|помилка сервера/i);
});
