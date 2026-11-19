import { WorkoutListRequestError } from '@/features/workouts/api/workouts-list-query';

/** Map HTTP failure categories to translated Dashboard copy, never API text. */
export function getDashboardWorkoutErrorKey(error: unknown) {
  const status = error instanceof WorkoutListRequestError ? error.status : undefined;
  if (status === 429) return 'workoutHero.errorRateLimited' as const;
  if (status === 403) return 'workoutHero.errorForbidden' as const;
  if (status === 400) return 'workoutHero.errorBadRequest' as const;
  return 'workoutHero.errorDefault' as const;
}
