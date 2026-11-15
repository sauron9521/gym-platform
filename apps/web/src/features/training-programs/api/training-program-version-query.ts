import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getProgramWorkoutsLoadError } from '../lib/create-program-workout';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';

export class TrainingProgramVersionRequestError extends Error {
  constructor(readonly status?: number) {
    super(getProgramWorkoutsLoadError(status));
    this.name = 'TrainingProgramVersionRequestError';
  }
}

export function trainingProgramVersionQueryOptions(programId: string, versionId: string) {
  return queryOptions({
    queryKey: trainingProgramQueryKeys.version(programId, versionId),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET(
          '/training-programs/{programId}/versions/{versionId}',
          {
            signal,
            params: { path: { programId, versionId } },
          },
        );

        if (response.status !== 200 || !data) {
          throw new TrainingProgramVersionRequestError(response.status);
        }

        return data;
      } catch (error) {
        if (error instanceof TrainingProgramVersionRequestError || signal.aborted) throw error;
        throw new TrainingProgramVersionRequestError();
      }
    },
    retry: false,
  });
}
