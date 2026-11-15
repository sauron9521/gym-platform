import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';
import {
  getProgramListError,
  getProgramPageCount,
  type AssignmentStatusFilter,
} from '../lib/training-programs-list';

const PAGE_SIZE = 20;

export class AthleteAssignmentsListRequestError extends Error {
  constructor(readonly status?: number) {
    super(getProgramListError(status));
    this.name = 'AthleteAssignmentsListRequestError';
  }
}

export function athleteAssignmentsListQueryOptions(status: AssignmentStatusFilter, page: number) {
  return queryOptions({
    queryKey: trainingProgramQueryKeys.assignmentList(status, page),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET('/training-programs/assignments', {
          signal,
          params: {
            query: {
              page,
              limit: PAGE_SIZE,
              view: 'summary',
              ...(status === 'ALL' ? {} : { status }),
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new AthleteAssignmentsListRequestError(response.status);
        }

        return {
          assignments: data.data,
          total: data.meta.total,
          pages: getProgramPageCount(data.meta.totalPages),
        };
      } catch (error) {
        if (error instanceof AthleteAssignmentsListRequestError || signal.aborted) throw error;
        throw new AthleteAssignmentsListRequestError();
      }
    },
    retry: false,
  });
}
