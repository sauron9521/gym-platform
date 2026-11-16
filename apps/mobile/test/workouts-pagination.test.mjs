import assert from 'node:assert/strict';
import { test } from 'vitest';

import { nextWorkoutPage } from '../src/features/workouts/model/workouts-query.ts';

test('pagination stops at last page and does not request an extra page', () => {
  assert.equal(nextWorkoutPage({ meta: { totalPages: 4 } }, 1), 2);
  assert.equal(nextWorkoutPage({ meta: { totalPages: 4 } }, 4), undefined);
  assert.equal(nextWorkoutPage({ meta: { totalPages: 0 } }, 1), undefined);
});
