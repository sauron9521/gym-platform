'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

import { getWorkoutSetSubmitError, type WorkoutSetPayload } from '../lib/workout-set-form';
import { workoutQueryKeys } from '../lib/workout-query-keys';

export class WorkoutSetMutationError extends Error {
  constructor(readonly status?: number) {
    super(getWorkoutSetSubmitError(status));
    this.name = 'WorkoutSetMutationError';
  }
}

type UpdateWorkoutSetInput = {
  setId: string;
  body: WorkoutSetPayload;
};

export function useUpdateWorkoutSetMutation(workoutId: string) {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  return useMutation<void, WorkoutSetMutationError, UpdateWorkoutSetInput>({
    mutationFn: async ({ setId, body }) => {
      try {
        const { response } = await webApi.PATCH('/workouts/{id}/sets/{setId}', {
          params: { path: { id: workoutId, setId } },
          body,
        });

        if (response.status !== 200) {
          throw new WorkoutSetMutationError(response.status);
        }
      } catch (error) {
        if (error instanceof WorkoutSetMutationError) throw error;
        throw new WorkoutSetMutationError();
      }
    },
    onSuccess: async () => {
      // The set response is not a complete workout. Fetch the canonical
      // workout once rather than constructing a partial detail cache entry.
      await queryClient.invalidateQueries({
        queryKey: workoutQueryKeys.detail(workoutId),
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: workoutQueryKeys.lists(),
        refetchType: 'none',
      });
    },
    onError,
    retry: false,
  });
}
