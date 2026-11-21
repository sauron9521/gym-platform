'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

import {
  getWorkoutSetSubmitError,
  type WorkoutSetData,
  type WorkoutSetPayload,
} from '../lib/workout-set-form';
import type { WorkoutDetailsData } from '../lib/workout-details';
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

  return useMutation<WorkoutSetData, WorkoutSetMutationError, UpdateWorkoutSetInput>({
    mutationFn: async ({ setId, body }) => {
      try {
        const { data, response } = await webApi.PATCH('/workouts/{id}/sets/{setId}', {
          params: { path: { id: workoutId, setId } },
          body,
        });

        if (response.status !== 200 || !data || data.id !== setId || data.status !== body.status) {
          throw new WorkoutSetMutationError(response.status);
        }

        return data;
      } catch (error) {
        if (error instanceof WorkoutSetMutationError) throw error;
        throw new WorkoutSetMutationError();
      }
    },
    onSuccess: async (savedSet) => {
      // PATCH returns the canonical persisted set. Update only that set in
      // the cached workout, without replacing unrelated exercises or records.
      // A background refetch reconciles the full workout with the server.
      queryClient.setQueryData<WorkoutDetailsData>(
        workoutQueryKeys.detail(workoutId),
        (current) => {
          if (!current) return current;
          const hasSet = current.exercises.some((exercise) =>
            exercise.sets.some((set) => set.id === savedSet.id),
          );
          if (!hasSet) return current;

          return {
            ...current,
            exercises: current.exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === savedSet.id ? savedSet : set)),
            })),
          };
        },
      );
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
