import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getExerciseDetailsErrorMessage } from '../lib/exercise-catalog';
import { exerciseQueryKeys } from '../lib/exercise-query-keys';

export class ExerciseDetailsRequestError extends Error {
  constructor(readonly status?: number) {
    super(getExerciseDetailsErrorMessage(status));
    this.name = 'ExerciseDetailsRequestError';
  }
}

export function exerciseDetailsQueryOptions(id: string) {
  return queryOptions({
    queryKey: exerciseQueryKeys.detail(id),
    queryFn: async ({ signal }) => {
      try {
        const { data, response } = await webApi.GET('/exercises/{id}', {
          signal,
          params: { path: { id } },
        });

        if (response.status !== 200 || !data || data.isArchived) {
          throw new ExerciseDetailsRequestError(data?.isArchived ? 404 : response.status);
        }

        return data;
      } catch (error) {
        if (error instanceof ExerciseDetailsRequestError || signal.aborted) throw error;
        throw new ExerciseDetailsRequestError();
      }
    },
    retry: false,
  });
}
