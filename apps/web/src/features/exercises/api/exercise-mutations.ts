'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

import { getCreateExerciseErrorMessage, type CreateExercisePayload } from '../lib/create-exercise';
import type { ExerciseDetailsData } from '../lib/exercise-catalog';
import { exerciseQueryKeys } from '../lib/exercise-query-keys';
import {
  getExerciseMutationErrorMessage,
  type UpdateExercisePayload,
} from '../lib/manage-exercise';

type ExerciseMutationOperation = 'create' | 'edit' | 'archive';

export class ExerciseMutationRequestError extends Error {
  constructor(
    readonly operation: ExerciseMutationOperation,
    readonly status?: number,
  ) {
    super(
      operation === 'create'
        ? getCreateExerciseErrorMessage(status)
        : getExerciseMutationErrorMessage(status),
    );
    this.name = 'ExerciseMutationRequestError';
  }
}

function useExerciseMutationContext() {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  async function invalidateLists() {
    // Catalog variants and exercise pickers share this query prefix.
    // Mark them stale without fetching every filter before navigation.
    await queryClient.invalidateQueries({
      queryKey: exerciseQueryKeys.lists(),
      refetchType: 'none',
    });
  }

  async function updateDetails(exercise: ExerciseDetailsData) {
    const queryKey = exerciseQueryKeys.detail(exercise.id);
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, exercise);
    await invalidateLists();
  }

  async function removeArchivedDetails(id: string) {
    await queryClient.cancelQueries({ queryKey: exerciseQueryKeys.detail(id), exact: true });
    queryClient.removeQueries({ queryKey: exerciseQueryKeys.detail(id), exact: true });
    await invalidateLists();
  }

  return { onError, invalidateLists, updateDetails, removeArchivedDetails };
}

export function useCreateExerciseMutation() {
  const { onError, invalidateLists } = useExerciseMutationContext();

  return useMutation<{ id: string }, ExerciseMutationRequestError, CreateExercisePayload>({
    mutationFn: async (body) => {
      try {
        const { data, response } = await webApi.POST('/exercises', { body });
        if (response.status !== 201 || !data) {
          throw new ExerciseMutationRequestError('create', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ExerciseMutationRequestError) throw error;
        throw new ExerciseMutationRequestError('create');
      }
    },
    onSuccess: invalidateLists,
    onError,
    retry: false,
  });
}

export function useEditExerciseMutation(id: string) {
  const { onError, updateDetails } = useExerciseMutationContext();

  return useMutation<ExerciseDetailsData, ExerciseMutationRequestError, UpdateExercisePayload>({
    mutationFn: async (body) => {
      try {
        const { data, response } = await webApi.PATCH('/exercises/{id}', {
          params: { path: { id } },
          body,
        });
        if (response.status !== 200 || !data) {
          throw new ExerciseMutationRequestError('edit', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ExerciseMutationRequestError) throw error;
        throw new ExerciseMutationRequestError('edit');
      }
    },
    onSuccess: updateDetails,
    onError,
    retry: false,
  });
}

export function useArchiveExerciseMutation(id: string) {
  const { onError, removeArchivedDetails } = useExerciseMutationContext();

  return useMutation<void, ExerciseMutationRequestError, void>({
    mutationFn: async () => {
      try {
        const { data, response } = await webApi.DELETE('/exercises/{id}', {
          params: { path: { id } },
        });
        if (response.status !== 200 || !data?.isArchived) {
          throw new ExerciseMutationRequestError('archive', response.status);
        }
      } catch (error) {
        if (error instanceof ExerciseMutationRequestError) throw error;
        throw new ExerciseMutationRequestError('archive');
      }
    },
    onSuccess: async () => removeArchivedDetails(id),
    onError,
    retry: false,
  });
}
