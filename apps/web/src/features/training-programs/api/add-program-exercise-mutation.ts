'use client';

import { useMutation } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import {
  getAddProgramExerciseError,
  type AddProgramExercisePayload,
} from '../lib/add-program-exercise';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { useProgramVersionMutationContext } from './program-version-mutation-context';

export class AddProgramExerciseMutationError extends Error {
  constructor(readonly status?: number) {
    super(getAddProgramExerciseError(status));
    this.name = 'AddProgramExerciseMutationError';
  }
}

export function useAddProgramExerciseMutation(
  programId: string,
  versionId: string,
  workoutId: string,
) {
  const { onError, updateVersion } = useProgramVersionMutationContext(programId, versionId);

  return useMutation<
    ProgramVersionWithWorkouts,
    AddProgramExerciseMutationError,
    AddProgramExercisePayload
  >({
    mutationFn: async (body) => {
      try {
        const { response, data } = await webApi.POST(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises',
          {
            params: { path: { programId, versionId, workoutId } },
            body,
          },
        );
        if (response.status !== 201 || !data) {
          throw new AddProgramExerciseMutationError(response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof AddProgramExerciseMutationError) throw error;
        throw new AddProgramExerciseMutationError();
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}
