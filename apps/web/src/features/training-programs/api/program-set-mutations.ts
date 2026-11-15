'use client';

import { useMutation } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getAddProgramSetError, type AddProgramSetPayload } from '../lib/add-program-set';
import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { getProgramSetMutationError, type UpdateProgramSetPayload } from '../lib/edit-program-set';
import {
  getReorderProgramSetsError,
  type ReorderProgramSetsPayload,
} from '../lib/reorder-program-sets';
import { useProgramVersionMutationContext } from './program-version-mutation-context';

type ProgramSetOperation = 'create' | 'edit' | 'delete' | 'reorder';

export class ProgramSetMutationError extends Error {
  constructor(
    readonly operation: ProgramSetOperation,
    readonly status?: number,
  ) {
    super(
      operation === 'create'
        ? getAddProgramSetError(status)
        : operation === 'reorder'
          ? getReorderProgramSetsError(status)
          : getProgramSetMutationError(operation, status),
    );
    this.name = 'ProgramSetMutationError';
  }
}

type SetPath = {
  programId: string;
  versionId: string;
  workoutId: string;
  exerciseId: string;
};

export function useCreateProgramSetMutation(path: SetPath) {
  const { onError, updateVersion } = useProgramVersionMutationContext(
    path.programId,
    path.versionId,
  );

  return useMutation<ProgramVersionWithWorkouts, ProgramSetMutationError, AddProgramSetPayload>({
    mutationFn: async (body) => {
      try {
        const { response, data } = await webApi.POST(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets',
          { params: { path }, body },
        );
        if (response.status !== 201 || !data) {
          throw new ProgramSetMutationError('create', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramSetMutationError) throw error;
        throw new ProgramSetMutationError('create');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}

type UpdateSetInput = { setId: string; body: UpdateProgramSetPayload };

export function useUpdateProgramSetMutation(path: SetPath) {
  const { onError, updateVersion } = useProgramVersionMutationContext(
    path.programId,
    path.versionId,
  );

  return useMutation<ProgramVersionWithWorkouts, ProgramSetMutationError, UpdateSetInput>({
    mutationFn: async ({ setId, body }) => {
      try {
        const { response, data } = await webApi.PATCH(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}',
          { params: { path: { ...path, setId } }, body },
        );
        if (response.status !== 200 || !data) {
          throw new ProgramSetMutationError('edit', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramSetMutationError) throw error;
        throw new ProgramSetMutationError('edit');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}

export function useDeleteProgramSetMutation(path: SetPath) {
  const { onError, updateVersion } = useProgramVersionMutationContext(
    path.programId,
    path.versionId,
  );

  return useMutation<ProgramVersionWithWorkouts, ProgramSetMutationError, string>({
    mutationFn: async (setId) => {
      try {
        const { response, data } = await webApi.DELETE(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}',
          { params: { path: { ...path, setId } } },
        );
        if (response.status !== 200 || !data) {
          throw new ProgramSetMutationError('delete', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramSetMutationError) throw error;
        throw new ProgramSetMutationError('delete');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}

export function useReorderProgramSetsMutation(path: SetPath) {
  const { onError, updateVersion } = useProgramVersionMutationContext(
    path.programId,
    path.versionId,
  );

  return useMutation<ProgramVersionWithWorkouts, ProgramSetMutationError, ReorderProgramSetsPayload>({
    mutationFn: async (body) => {
      try {
        const { response, data } = await webApi.PATCH(
          '/training-programs/{programId}/versions/{versionId}/workouts/{workoutId}/exercises/{exerciseId}/sets/reorder',
          { params: { path }, body },
        );
        if (response.status !== 200 || !data) {
          throw new ProgramSetMutationError('reorder', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProgramSetMutationError) throw error;
        throw new ProgramSetMutationError('reorder');
      }
    },
    onSuccess: updateVersion,
    onError,
    retry: false,
  });
}
