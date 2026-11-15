import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getExerciseErrorMessage, getExercisePageCount } from '../lib/exercise-catalog';
import {
  exerciseQueryKeys,
  normalizeExerciseCatalogFilters,
  type ExerciseCatalogFilters,
} from '../lib/exercise-query-keys';

const PAGE_SIZE = 20;

export class ExerciseListRequestError extends Error {
  constructor(readonly status?: number) {
    super(getExerciseErrorMessage(status));
    this.name = 'ExerciseListRequestError';
  }
}

export function exerciseListQueryOptions(filters: ExerciseCatalogFilters) {
  const normalized = normalizeExerciseCatalogFilters(filters);

  return queryOptions({
    queryKey: exerciseQueryKeys.list(normalized),
    queryFn: async ({ signal }) => {
      try {
        const { data, response } = await webApi.GET('/exercises', {
          signal,
          params: {
            query: {
              page: normalized.page,
              limit: PAGE_SIZE,
              ...(normalized.search ? { search: normalized.search } : {}),
              ...(normalized.exerciseType === 'ALL' ? {} : { exerciseType: normalized.exerciseType }),
              ...(normalized.muscleGroup ? { muscleGroup: normalized.muscleGroup } : {}),
              ...(normalized.equipment ? { equipment: normalized.equipment } : {}),
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new ExerciseListRequestError(response.status);
        }

        return {
          exercises: data.data.filter((exercise) => !exercise.isArchived),
          total: data.meta.total,
          pages: getExercisePageCount(data.meta.totalPages),
        };
      } catch (error) {
        if (error instanceof ExerciseListRequestError || signal.aborted) throw error;
        throw new ExerciseListRequestError();
      }
    },
    retry: false,
  });
}
