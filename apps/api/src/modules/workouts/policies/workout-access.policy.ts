import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { WorkoutListQuery } from '../types/workout.types.js';

type AthleteAccessCapabilities = { athlete: boolean; admin: boolean };

/**
 * Accept only a CURRENT persisted account capability snapshot, never a JWT
 * role. Legacy TRAINER identities retain their own Athlete features.
 */
export function assertWorkoutAthlete(capabilities: AthleteAccessCapabilities): void {
  if (!capabilities.athlete || capabilities.admin) {
    throw new ForbiddenException('Only athletes can manage personal workouts');
  }
}

/** Preserve the existing public pagination limits and error message. */
export function validateWorkoutPagination(query: WorkoutListQuery): void {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100
  ) {
    throw new BadRequestException('Invalid pagination parameters');
  }
}
