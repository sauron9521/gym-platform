import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { trainerAthleteQueryKeys, type RelationshipActorRole } from '../lib/trainer-athlete-query-keys';
import {
  getTrainerAthleteListErrorMessage,
  getTrainerAthletePageCount,
  type TrainerAthleteFilter,
} from '../lib/trainer-athletes-list';

const PAGE_SIZE = 20;

export class TrainerAthleteListRequestError extends Error {
  constructor(readonly status?: number) {
    super(getTrainerAthleteListErrorMessage(status));
    this.name = 'TrainerAthleteListRequestError';
  }
}

export function trainerAthleteListQueryOptions(
  actorId: string,
  actorRole: RelationshipActorRole,
  filter: TrainerAthleteFilter,
  page: number,
) {
  return queryOptions({
    queryKey: trainerAthleteQueryKeys.list(actorId, actorRole, filter, page),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET('/trainer-athletes', {
          signal,
          params: {
            query: {
              page,
              limit: PAGE_SIZE,
              ...(filter === 'ALL' ? {} : { status: filter }),
            },
          },
        });

        if (response.status !== 200 || !data) {
          throw new TrainerAthleteListRequestError(response.status);
        }

        return {
          relationships: data.data,
          total: data.meta.total,
          pages: getTrainerAthletePageCount(data.meta.totalPages),
        };
      } catch (error) {
        if (error instanceof TrainerAthleteListRequestError || signal.aborted) throw error;
        throw new TrainerAthleteListRequestError();
      }
    },
    retry: false,
  });
}
