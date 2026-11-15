import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';
import {
  getProgramListError,
  getProgramPageCount,
  type ProgramStatusFilter,
} from '../lib/training-programs-list';

const PAGE_SIZE = 20;

export class TrainerProgramListRequestError extends Error {
  constructor(readonly status?: number) {
    super(getProgramListError(status));
    this.name = 'TrainerProgramListRequestError';
  }
}

export function trainerProgramsListQueryOptions(status: ProgramStatusFilter, page: number) {
  return queryOptions({
    queryKey: trainingProgramQueryKeys.list(status, page),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET('/training-programs', {
          signal,
          params: {
            query: {
              page,
              limit: PAGE_SIZE,
              ...(status === 'ALL' ? {} : { status }),
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new TrainerProgramListRequestError(response.status);
        }

        return {
          programs: data.data,
          total: data.meta.total,
          pages: getProgramPageCount(data.meta.totalPages),
        };
      } catch (error) {
        if (error instanceof TrainerProgramListRequestError || signal.aborted) throw error;
        throw new TrainerProgramListRequestError();
      }
    },
    retry: false,
  });
}
