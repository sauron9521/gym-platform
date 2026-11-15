import type { WorkoutFilter } from './workouts-list';

export const workoutQueryKeys = {
  all: ['workouts'] as const,
  lists: () => [...workoutQueryKeys.all, 'list'] as const,
  list: (filter: WorkoutFilter, page: number) =>
    [...workoutQueryKeys.lists(), { filter, page }] as const,
  details: () => [...workoutQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...workoutQueryKeys.details(), id] as const,
};
