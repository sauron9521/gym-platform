import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import {
  getWorkoutListErrorMessage,
  getWorkoutPageCount,
  type WorkoutFilter,
} from '../lib/workouts-list';
import { workoutQueryKeys } from '../lib/workout-query-keys';

const PAGE_SIZE = 10;

export class WorkoutListRequestError extends Error {
  constructor(readonly status?: number) {
    super(getWorkoutListErrorMessage(status));
    this.name = 'WorkoutListRequestError';
  }
}

export function workoutListQueryOptions(
  filter: WorkoutFilter,
  page: number,
  sort?: 'completedAtDesc',
) {
  return queryOptions({
    queryKey: sort
      ? [...workoutQueryKeys.lists(), { filter, page, sort }]
      : workoutQueryKeys.list(filter, page),
    queryFn: async ({ signal }) => {
      try {
        const { data, response } = await webApi.GET('/workouts', {
          signal,
          params: {
            query: {
              page,
              limit: PAGE_SIZE,
              view: 'summary',
              ...(filter === 'ALL' ? {} : { status: filter }),
              ...(sort ? { sort } : {}),
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new WorkoutListRequestError(response.status);
        }

        return {
          workouts: data.data,
          total: data.meta.total,
          totalPages: getWorkoutPageCount(data.meta.totalPages),
        };
      } catch (error) {
        // Let TanStack Query handle cancellations instead of surfacing them as API failures.
        if (error instanceof WorkoutListRequestError || signal.aborted) throw error;
        throw new WorkoutListRequestError();
      }
    },
    retry: false,
  });
}
