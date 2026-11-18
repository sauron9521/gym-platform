import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { WorkoutListRequestError } from './workouts-list-query';
import { workoutQueryKeys } from '../lib/workout-query-keys';

/**
 * Next PLANNED workout by scheduledAt, not createdAt. A fresh lower bound is
 * computed for each fetch so refetches cannot include workouts in the past.
 */
export function nextPlannedWorkoutQueryOptions() {
  return queryOptions({
    queryKey: workoutQueryKeys.nextPlanned(),
    queryFn: async ({ signal }) => {
      try {
        const requestedFrom = new Date().toISOString();
        const { data, response } = await webApi.GET('/workouts', {
          signal,
          params: {
            query: {
              view: 'summary',
              status: 'PLANNED',
              sort: 'scheduledAtAsc',
              scheduledFrom: requestedFrom,
              page: 1,
              limit: 1,
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new WorkoutListRequestError(response.status);
        }

        return { workout: data.data[0] ?? null, total: data.meta.total, requestedFrom };
      } catch (error) {
        if (error instanceof WorkoutListRequestError || signal.aborted) throw error;
        throw new WorkoutListRequestError();
      }
    },
    retry: false,
    // Refresh the date bound while the dashboard is open, including after
    // midnight or a scheduled workout's start time passes.
    refetchInterval: 60_000,
  });
}
