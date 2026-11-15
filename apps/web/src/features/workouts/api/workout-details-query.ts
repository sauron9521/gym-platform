import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getWorkoutDetailsErrorMessage } from '../lib/workout-details';
import { workoutQueryKeys } from '../lib/workout-query-keys';

export class WorkoutDetailsRequestError extends Error {
  constructor(readonly status?: number) {
    super(getWorkoutDetailsErrorMessage(status));
    this.name = 'WorkoutDetailsRequestError';
  }
}

export function workoutDetailsQueryOptions(id: string) {
  return queryOptions({
    queryKey: workoutQueryKeys.detail(id),
    queryFn: async ({ signal }) => {
      try {
        const { data, response } = await webApi.GET('/workouts/{id}', {
          signal,
          params: { path: { id } },
        });

        if (response.status !== 200 || !data) {
          throw new WorkoutDetailsRequestError(response.status);
        }

        return data;
      } catch (error) {
        if (error instanceof WorkoutDetailsRequestError || signal.aborted) throw error;
        throw new WorkoutDetailsRequestError();
      }
    },
    retry: false,
  });
}
