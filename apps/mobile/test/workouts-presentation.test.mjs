import assert from 'node:assert/strict';
import { test } from 'vitest';

import { workoutStatusLabel } from '../src/features/workouts/lib/workout-presentation.ts';

test('workout status labels are localized and exhaustive', () => {
  assert.equal(workoutStatusLabel('PLANNED'), 'Заплановано');
  assert.equal(workoutStatusLabel('IN_PROGRESS'), 'Триває');
  assert.equal(workoutStatusLabel('COMPLETED'), 'Завершено');
  assert.equal(workoutStatusLabel('CANCELLED'), 'Скасовано');
});
