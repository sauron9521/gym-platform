import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  workoutSetFormSchema,
  workoutSetPayload,
} from '../src/features/workouts/lib/workout-set-form.ts';

test('workout set validation permits empty planned fields and converts comma decimals', () => {
  const parsed = workoutSetFormSchema.parse({ actualReps: ' 8 ', actualWeightKg: ' 62,5 ' });
  assert.deepEqual(workoutSetPayload(parsed), {
    status: 'COMPLETED',
    actualReps: 8,
    actualWeightKg: 62.5,
  });
  assert.deepEqual(workoutSetPayload({ actualReps: '', actualWeightKg: '' }), {
    status: 'COMPLETED',
    actualReps: null,
    actualWeightKg: null,
  });
});

test('workout set validation rejects negative, zero, impossible and malformed input', () => {
  for (const invalid of [
    { actualReps: '0', actualWeightKg: '20' },
    { actualReps: '000', actualWeightKg: '20' },
    { actualReps: '-5', actualWeightKg: '20' },
    { actualReps: '2.5', actualWeightKg: '' },
    { actualReps: '1500', actualWeightKg: '10' },
    { actualReps: '8', actualWeightKg: '-1' },
    { actualReps: '8', actualWeightKg: '23.999' },
  ]) {
    assert.equal(workoutSetFormSchema.safeParse(invalid).success, false);
  }
});
