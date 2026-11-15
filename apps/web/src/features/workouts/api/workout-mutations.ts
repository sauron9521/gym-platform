'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

import { buildCreateWorkoutPayload, getCreateWorkoutErrorMessage } from '../lib/create-workout';
import { getWorkoutEditErrorMessage, type WorkoutEditPayload } from '../lib/edit-workout';
import { getWorkoutActionErrorMessage, type WorkoutAction } from '../lib/workout-actions';
import type { WorkoutDetailsData } from '../lib/workout-details';
import { workoutQueryKeys } from '../lib/workout-query-keys';

export class WorkoutMutationRequestError extends Error {
  constructor(
    readonly operation: 'create' | 'update' | 'action',
    readonly status?: number,
  ) {
    super(
      operation === 'create'
        ? getCreateWorkoutErrorMessage(status)
        : operation === 'update'
          ? getWorkoutEditErrorMessage(status)
          : getWorkoutActionErrorMessage(status),
    );
    this.name = 'WorkoutMutationRequestError';
  }
}

function useWorkoutMutationContext() {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  function markListsStale() {
    return queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.lists(),
      refetchType: 'none',
    });
  }

  function updateDetails(workout: WorkoutDetailsData) {
    queryClient.setQueryData(workoutQueryKeys.detail(workout.id), workout);
    return markListsStale();
  }

  return { markListsStale, updateDetails, onError };
}

type CreateWorkoutInput = {
  body: ReturnType<typeof buildCreateWorkoutPayload>;
  idempotencyKey: string;
};

export function useCreateWorkoutMutation() {
  const { markListsStale, onError } = useWorkoutMutationContext();

  return useMutation<{ id: string }, WorkoutMutationRequestError, CreateWorkoutInput>({
    mutationFn: async ({ body, idempotencyKey }) => {
      try {
        const { data, response } = await webApi.POST('/workouts', {
          body,
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        });
        if (response.status !== 201 || !data) {
          throw new WorkoutMutationRequestError('create', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof WorkoutMutationRequestError) throw error;
        throw new WorkoutMutationRequestError('create');
      }
    },
    onSuccess: markListsStale,
    onError,
    retry: false,
  });
}

export function useUpdateWorkoutMutation(id: string) {
  const { updateDetails, onError } = useWorkoutMutationContext();

  return useMutation<WorkoutDetailsData, WorkoutMutationRequestError, WorkoutEditPayload>({
    mutationFn: async (body) => {
      try {
        const { data, response } = await webApi.PATCH('/workouts/{id}', {
          params: { path: { id } },
          body,
        });
        if (response.status !== 200 || !data) {
          throw new WorkoutMutationRequestError('update', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof WorkoutMutationRequestError) throw error;
        throw new WorkoutMutationRequestError('update');
      }
    },
    onSuccess: updateDetails,
    onError,
    retry: false,
  });
}

export function useWorkoutActionMutation(id: string) {
  const { updateDetails, onError } = useWorkoutMutationContext();

  return useMutation<WorkoutDetailsData, WorkoutMutationRequestError, WorkoutAction>({
    mutationFn: async (action) => {
      try {
        const params = { path: { id } };
        const result =
          action === 'start'
            ? await webApi.POST('/workouts/{id}/start', { params })
            : action === 'complete'
              ? await webApi.POST('/workouts/{id}/complete', { params })
              : await webApi.POST('/workouts/{id}/cancel', { params });

        if (result.response.status !== 200 || !result.data) {
          throw new WorkoutMutationRequestError('action', result.response.status);
        }
        return result.data;
      } catch (error) {
        if (error instanceof WorkoutMutationRequestError) throw error;
        throw new WorkoutMutationRequestError('action');
      }
    },
    onSuccess: updateDetails,
    onError,
    retry: false,
  });
}
