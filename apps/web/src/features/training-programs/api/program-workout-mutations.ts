'use client';

import { useMutation } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import {
  getCreateProgramWorkoutError,
  type CreateProgramWorkoutPayload,
  type ProgramVersionWithWorkouts,
} from '../lib/create-program-workout';
import {
  getProgramWorkoutMutationError,
  type UpdateProgramWorkoutPayload,
} from '../lib/edit-program-workout';
import { useProgramVersionMutationContext } from './program-version-mutation-context';

type ProgramWorkoutOperation = 'create' | 'edit' | 'delete';

export class ProgramWorkoutMutationError extends Error {
  constructor(
    readonly operation: ProgramWorkoutOperation,
    readonly status?: number,
  ) {
    super(
      operation === 'create'
        ? getCreateProgramWorkoutError(status)
        : getProgramWorkoutMutationError(operation, status),
    );
    this.name = 'ProgramWorkoutMutationError';
  }
}

export function useCreateProgramWorkoutMutation(programId: string, versionId: string) {
  const { onError, updateVersion } = useProgramVersionMutationContext(programId, versionId);

  return useMutation<
    ProgramVersionWithWorkouts,
    ProgramWorkoutMutationError,
    CreateProgramWorkoutPayload
  >({
    mutationFn: async (body) => {
      try {
        const { response, data } = await webApi.POST(
          '/training-programs/{programId}/versions/{versionId}/workouts',
          { params: { path: { programId, versionId } }, body },
        );
        if (response.status !== 201 || !data) {
          throw new ProgramWorkoutMutationError('create', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramWorkoutMutationError) throw error;
        throw new ProgramWorkoutMutationError('create');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}

type EditProgramWorkoutInput = { workoutId: string; body: UpdateProgramWorkoutPayload };

export function useEditProgramWorkoutMutation(programId: string, versionId: string) {
  const { onError, updateVersion } = useProgramVersionMutationContext(programId, versionId);

  return useMutation<
    ProgramVersionWithWorkouts,
    ProgramWorkoutMutationError,
    EditProgramWorkoutInput
  >({
    mutationFn: async ({ workoutId, body }) => {
      try {
        const { response, data } = await webApi.PATCH(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}',
          { params: { path: { programId, versionId, workoutId } }, body },
        );
        if (response.status !== 200 || !data) {
          throw new ProgramWorkoutMutationError('edit', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramWorkoutMutationError) throw error;
        throw new ProgramWorkoutMutationError('edit');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}

export function useDeleteProgramWorkoutMutation(programId: string, versionId: string) {
  const { onError, updateVersion } = useProgramVersionMutationContext(programId, versionId);

  return useMutation<ProgramVersionWithWorkouts, ProgramWorkoutMutationError, string>({
    mutationFn: async (workoutId) => {
      try {
        const { response, data } = await webApi.DELETE(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}',
          { params: { path: { programId, versionId, workoutId } } },
        );
        if (response.status !== 200 || !data) {
          throw new ProgramWorkoutMutationError('delete', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramWorkoutMutationError) throw error;
        throw new ProgramWorkoutMutationError('delete');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}
