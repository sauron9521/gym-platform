import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getTrainingProgramDetailsError } from '../lib/edit-training-program-draft';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';

export class TrainerProgramDetailsRequestError extends Error {
  constructor(readonly status?: number) {
    super(getTrainingProgramDetailsError(status));
    this.name = 'TrainerProgramDetailsRequestError';
  }
}

export function trainerProgramDetailsQueryOptions(programId: string) {
  return queryOptions({
    queryKey: trainingProgramQueryKeys.detail(programId),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET('/training-programs/{programId}', {
          signal,
          params: { path: { programId } },
        });

        if (response.status !== 200 || !data) {
          throw new TrainerProgramDetailsRequestError(response.status);
        }

        return data;
      } catch (error) {
        if (error instanceof TrainerProgramDetailsRequestError || signal.aborted) throw error;
        throw new TrainerProgramDetailsRequestError();
      }
    },
    retry: false,
  });
}
