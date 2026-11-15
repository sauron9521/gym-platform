import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { exerciseQueryKeys } from '../lib/exercise-query-keys';
import { getTaxonomyErrorMessage } from '../lib/exercise-taxonomy';

export class ExerciseTaxonomyRequestError extends Error {
  constructor(readonly status?: number) {
    super(getTaxonomyErrorMessage(status));
    this.name = 'ExerciseTaxonomyRequestError';
  }
}

export function exerciseTaxonomyQueryOptions() {
  return queryOptions({
    queryKey: exerciseQueryKeys.taxonomy(),
    queryFn: async ({ signal }) => {
      try {
        const [muscles, equipment] = await Promise.all([
          webApi.GET('/exercises/muscle-groups', { signal }),
          webApi.GET('/exercises/equipment', { signal }),
        ]);

        if (
          muscles.response.status !== 200 ||
          equipment.response.status !== 200 ||
          !muscles.data ||
          !equipment.data
        ) {
          const status =
            muscles.response.status === 401 || equipment.response.status === 401
              ? 401
              : muscles.response.status !== 200
                ? muscles.response.status
                : equipment.response.status;
          throw new ExerciseTaxonomyRequestError(status);
        }

        return { muscleGroups: muscles.data, equipment: equipment.data };
      } catch (error) {
        if (error instanceof ExerciseTaxonomyRequestError || signal.aborted) throw error;
        throw new ExerciseTaxonomyRequestError();
      }
    },
    retry: false,
  });
}
