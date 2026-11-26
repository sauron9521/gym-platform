import { queryOptions, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useAppSettings } from '@/features/app-settings/model/app-settings-context';
import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';
import { MobileSessionExpiredError, mobileReadError } from '@/shared/api/api-error-policy';
import type { createMobileApi } from '@/shared/api/client';
import {
  parsePreviousSets,
  previousSetExerciseIds,
  type PreviousSets,
} from '../lib/previous-set-hints';
import type { WorkoutDetails } from './workout-details-query';

type Scope = {
  accountId: string;
  workoutId: string;
  client: QueryClient;
  getScopedApi: (isCurrent: () => boolean) => ReturnType<typeof createMobileApi> | null;
  signOut: () => Promise<void>;
};

export function previousSetsOptions(scope: Scope, exerciseId: string) {
  return queryOptions({
    queryKey: accountQueryKeys.previousSets(scope.accountId, scope.workoutId, exerciseId),
    queryFn: async ({ signal }) => {
      const markerKey = accountQueryKeys.me(scope.accountId);
      const marker = scope.client.getQueryCache().find({ queryKey: markerKey, exact: true });
      const current = () =>
        !signal.aborted &&
        Boolean(marker && scope.client.getQueryData(markerKey)) &&
        scope.client.getQueryCache().find({ queryKey: markerKey, exact: true }) === marker;
      const assertCurrent = () => {
        if (!current()) {
          const error = new Error('Previous sets session changed');
          error.name = 'AbortError';
          throw error;
        }
      };
      assertCurrent();
      const api = scope.getScopedApi(current);
      if (!api) throw new Error('Previous sets API unavailable');
      const result = await api.GET('/workout-analytics/exercises/{exerciseId}/previous-sets', {
        params: { path: { exerciseId } },
        signal,
      });
      assertCurrent();
      if (result.response.status === 401) {
        await scope.signOut();
        throw new MobileSessionExpiredError();
      }
      if (result.response.status !== 200)
        throw mobileReadError(result.response.status, 'Previous sets unavailable');
      return parsePreviousSets(result.data, exerciseId);
    },
    // Optional information: avoid background refresh storms and retries on
    // shared analytics throttling. Fresh workout = fresh query key.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function usePreviousSetHints(workout: WorkoutDetails | undefined) {
  const { account, capabilities, getScopedApi, signOut } = useAuth();
  const client = useQueryClient();
  const enabled = useAppSettings(
    (state) => state.settings.showPreviousSets && state.settings.accountId === account?.id,
  );
  const accountId = account?.id ?? null;
  const ids =
    enabled && hasAthleteAccess(capabilities) ? previousSetExerciseIds(workout, accountId) : [];
  const results = useQueries({
    queries: ids.map((id) =>
      previousSetsOptions(
        {
          accountId: accountId!,
          workoutId: workout!.id,
          client,
          getScopedApi,
          signOut,
        },
        id,
      ),
    ),
  });
  const histories = new Map<string, PreviousSets>();
  for (const [index, result] of results.entries()) {
    if (result.isSuccess && result.data) histories.set(ids[index]!, result.data);
  }
  return histories;
}
