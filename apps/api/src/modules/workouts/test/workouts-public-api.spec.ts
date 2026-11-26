import { ForbiddenException } from '@nestjs/common';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { assertWorkoutAthlete, type WorkoutActor } from '../public-api.js';
import type { WorkoutActor as InternalWorkoutActor } from '../types/workout.types.js';
import { assertWorkoutAthlete as internalAssertWorkoutAthlete } from '../policies/workout-access.policy.js';

describe('Workouts public athlete authorization contract', () => {
  it('re-exports the exact canonical policy without duplicated authorization logic', () => {
    expect(assertWorkoutAthlete).toBe(internalAssertWorkoutAthlete);
  });

  it('exposes the exact existing actor type, without adding a runtime export', () => {
    expectTypeOf<WorkoutActor>().toEqualTypeOf<InternalWorkoutActor>();
    expectTypeOf<WorkoutActor['id']>().toEqualTypeOf<string>();
  });

  it('accepts only persisted athlete capability and denies admins', () => {
    expect(() => assertWorkoutAthlete({ athlete: true, admin: false })).not.toThrow();
    expect(() => assertWorkoutAthlete({ athlete: false, admin: false })).toThrow(
      ForbiddenException,
    );
    expect(() => assertWorkoutAthlete({ athlete: true, admin: true })).toThrow(ForbiddenException);
    expect(() => assertWorkoutAthlete({ athlete: false, admin: true })).toThrow(
      'Only athletes can manage personal workouts',
    );
  });
});
