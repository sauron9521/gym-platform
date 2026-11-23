import { describe, expect, it } from 'vitest';

import {
  buildExerciseVisibilityWhere,
  workoutExerciseReferenceSelect,
} from '../public-api.js';
import { buildExerciseVisibilityWhere as internalVisibilityWhere } from '../policies/exercise-access.policy.js';
import { workoutExerciseReferenceSelect as internalReferenceSelect } from '../selects/exercise.select.js';

describe('Exercises public workout read contract', () => {
  it('re-exports the canonical visibility policy without a second authorization rule', () => {
    expect(buildExerciseVisibilityWhere).toBe(internalVisibilityWhere);
  });

  it('re-exports the same minimal reference projection, without private fields', () => {
    expect(workoutExerciseReferenceSelect).toBe(internalReferenceSelect);
    expect(workoutExerciseReferenceSelect).toEqual({
      id: true,
      name: true,
      exerciseType: true,
    });
  });
});
