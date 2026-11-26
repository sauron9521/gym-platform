import { expectTypeOf } from 'vitest';
import type { ExerciseAccessContext } from '../public-api.js';
import type { ExerciseAccessContext as InternalExerciseAccessContext } from '../types/exercise.types.js';

describe('Exercises public relationship context', () => {
  it('re-exports the exact canonical context type', () => {
    expectTypeOf<ExerciseAccessContext>().toEqualTypeOf<InternalExerciseAccessContext>();
  });
});
