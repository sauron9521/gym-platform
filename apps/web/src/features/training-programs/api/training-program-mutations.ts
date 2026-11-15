'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { webApi } from '@/shared/api/client';

import {
  buildCreateTrainingProgramPayload,
  getCreateTrainingProgramErrorMessage,
  type CreateTrainingProgramValues,
} from '../lib/create-training-program';
import {
  buildUpdateTrainingProgramDraftPayload,
  getUpdateTrainingProgramDraftError,
  type EditTrainingProgramDraftValues,
} from '../lib/edit-training-program-draft';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';
import type {
  TrainingProgramItem,
  TrainingProgramVersionItem,
} from '../lib/training-programs-list';

export class TrainingProgramMutationRequestError extends Error {
  constructor(readonly operation: 'create' | 'update', readonly status?: number) {
    super(
      operation === 'create'
        ? getCreateTrainingProgramErrorMessage(status)
        : getUpdateTrainingProgramDraftError(status),
    );
    this.name = 'TrainingProgramMutationRequestError';
  }
}

function useTrainingProgramMutationContext() {
  const queryClient = useQueryClient();
  const router = useRouter();

  function onError(error: TrainingProgramMutationRequestError) {
    if (error.status === 401) {
      queryClient.clear();
      router.replace('/login');
    }
  }

  return { queryClient, onError };
}

export function useCreateTrainingProgramMutation() {
  const { queryClient, onError } = useTrainingProgramMutationContext();

  return useMutation<unknown, TrainingProgramMutationRequestError, CreateTrainingProgramValues>({
    mutationFn: async (values) => {
      try {
        const { response, data } = await webApi.POST('/training-programs', {
          body: buildCreateTrainingProgramPayload(values),
        });
        if (response.status !== 201 || !data) {
          throw new TrainingProgramMutationRequestError('create', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof TrainingProgramMutationRequestError) throw error;
        throw new TrainingProgramMutationRequestError('create');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingProgramQueryKeys.lists() }),
    onError,
    retry: false,
  });
}

export function useUpdateTrainingProgramDraftMutation(programId: string, versionId: string) {
  const { queryClient, onError } = useTrainingProgramMutationContext();

  return useMutation<
    TrainingProgramVersionItem,
    TrainingProgramMutationRequestError,
    EditTrainingProgramDraftValues
  >({
    mutationFn: async (values) => {
      try {
        const { response, data } = await webApi.PATCH(
          '/training-programs/{programId}/versions/{versionId}',
          {
            params: { path: { programId, versionId } },
            body: buildUpdateTrainingProgramDraftPayload(values),
          },
        );
        if (response.status !== 200 || !data) {
          throw new TrainingProgramMutationRequestError('update', response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof TrainingProgramMutationRequestError) throw error;
        throw new TrainingProgramMutationRequestError('update');
      }
    },
    onSuccess: async (version) => {
      queryClient.setQueryData<TrainingProgramItem>(
        trainingProgramQueryKeys.detail(programId),
        (current) =>
          current
            ? {
                ...current,
                versions: current.versions.map((item) => (item.id === version.id ? version : item)),
              }
            : current,
      );
      // The standalone version query may contain nested workouts. Mark it
      // stale without replacing its nested data or spending another GET here.
      await queryClient.invalidateQueries({
        queryKey: trainingProgramQueryKeys.version(programId, versionId),
        refetchType: 'none',
      });
      await queryClient.invalidateQueries({ queryKey: trainingProgramQueryKeys.lists() });
    },
    onError,
    retry: false,
  });
}
