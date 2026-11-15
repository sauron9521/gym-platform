'use client';

import { useQueryClient } from '@tanstack/react-query';

import { useAuthFailure } from '@/shared/api/use-auth-failure';

import type { ProgramVersionWithWorkouts } from '../lib/create-program-workout';
import { trainingProgramQueryKeys } from '../lib/training-program-query-keys';

/**
 * Shared cache policy for mutations returning the complete program version.
 * Never replace a version query with a partial workout or exercise payload.
 */
export function useProgramVersionMutationContext(programId: string, versionId: string) {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  async function updateVersion(version: ProgramVersionWithWorkouts) {
    const queryKey = trainingProgramQueryKeys.version(programId, versionId);
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, version);
    // Program details and lists may contain summaries of this version.
    // Mark them stale without immediately fetching every mounted list.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trainingProgramQueryKeys.detail(programId),
        refetchType: 'none',
      }),
      queryClient.invalidateQueries({
        queryKey: trainingProgramQueryKeys.lists(),
        refetchType: 'none',
      }),
    ]);
  }

  return { onError, updateVersion };
}
