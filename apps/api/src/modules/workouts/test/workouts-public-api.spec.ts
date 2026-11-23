import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { assertWorkoutAthlete } from '../public-api.js';
import { assertWorkoutAthlete as internalAssertWorkoutAthlete } from '../policies/workout-access.policy.js';

describe('Workouts public athlete authorization contract', () => {
  it('re-exports the exact canonical policy without duplicated authorization logic', () => {
    expect(assertWorkoutAthlete).toBe(internalAssertWorkoutAthlete);
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
