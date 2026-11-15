'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';

import { trainerAthleteQueryKeys } from '../lib/trainer-athlete-query-keys';
import {
  getRelationshipMutationError,
  type RelationshipAction,
} from '../lib/trainer-athlete-actions';

export class RelationshipMutationRequestError extends Error {
  constructor(readonly status?: number) {
    super(getRelationshipMutationError(status));
    this.name = 'RelationshipMutationRequestError';
  }
}

function useRelationshipMutationCallbacks() {
  const queryClient = useQueryClient();
  const router = useRouter();

  function onError(error: RelationshipMutationRequestError) {
    if (error.status === 401) {
      queryClient.clear();
      router.replace('/login');
    }
  }

  return { queryClient, onError };
}

export function useInviteRelationshipMutation() {
  const { queryClient, onError } = useRelationshipMutationCallbacks();

  return useMutation({
    mutationFn: async (userId: string) => {
      try {
        const { response, data } = await webApi.POST('/trainer-athletes', {
          body: { userId },
        });

        if (response.status !== 201 || !data) {
          throw new RelationshipMutationRequestError(response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof RelationshipMutationRequestError) throw error;
        throw new RelationshipMutationRequestError();
      }
    },
    // Inviting changes which filter is displayed. Invalidate the old lists
    // without refetching the old filter and spending extra rate-limit budget.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: trainerAthleteQueryKeys.lists(),
        refetchType: 'none',
      }),
    onError,
    retry: false,
  });
}

type RelationshipActionInput = {
  id: string;
  action: RelationshipAction;
  reason: string | null;
};

export function useRelationshipActionMutation() {
  const { queryClient, onError } = useRelationshipMutationCallbacks();

  return useMutation({
    mutationFn: async ({ id, action, reason }: RelationshipActionInput) => {
      try {
        const body = { reason };
        const result =
          action === 'accept'
            ? await webApi.POST('/trainer-athletes/{id}/accept', { params: { path: { id } } })
            : action === 'decline'
              ? await webApi.POST('/trainer-athletes/{id}/decline', { params: { path: { id } } })
              : action === 'cancel'
                ? await webApi.POST('/trainer-athletes/{id}/cancel', {
                    params: { path: { id } },
                    body,
                  })
                : await webApi.POST('/trainer-athletes/{id}/terminate', {
                    params: { path: { id } },
                    body,
                  });

        if (result.response.status !== 200 || !result.data) {
          throw new RelationshipMutationRequestError(result.response.status);
        }
        return result.data;
      } catch (error) {
        if (error instanceof RelationshipMutationRequestError) throw error;
        throw new RelationshipMutationRequestError();
      }
    },
    // Only successful server responses may invalidate a relationship cache.
    // Refetch active lists once; other status/page entries become stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainerAthleteQueryKeys.lists() }),
    onError,
    retry: false,
  });
}
