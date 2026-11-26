import { onlineManager, queryOptions } from '@tanstack/react-query';

import type { createMobileApi } from '@/shared/api/client';
import {
  isSessionExpired,
  MobileSessionExpiredError,
  mobileReadError,
  shouldRetryMobileRead,
} from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';
import {
  parseStoredWorkoutPreferences,
  type WorkoutPreferencePatch,
} from './account-workout-preferences';

const path = '/users/me/preferences/workouts' as const;
const initializePath = '/users/me/preferences/workouts/initialize' as const;

type Scope = {
  accountId: string;
  isCurrent: () => boolean;
  getScopedApi: (isCurrent: () => boolean) => ReturnType<typeof createMobileApi> | null;
};

function assertCurrent(scope: Scope, signal?: AbortSignal) {
  if (!scope.isCurrent() || signal?.aborted) {
    const error = new Error('Workout preference session changed');
    error.name = 'AbortError';
    throw error;
  }
}

function scopedApi(scope: Scope, signal?: AbortSignal) {
  assertCurrent(scope, signal);
  const api = scope.getScopedApi(() => scope.isCurrent() && !signal?.aborted);
  if (!api) throw new Error('Workout preference API unavailable');
  return api;
}

function confirmed(scope: Scope, status: number, data: unknown, signal?: AbortSignal) {
  assertCurrent(scope, signal);
  if (isSessionExpired(status)) throw new MobileSessionExpiredError();
  if (status !== 200) throw mobileReadError(status, 'Workout preferences unavailable');
  const parsed = parseStoredWorkoutPreferences(data);
  if (!parsed) throw new Error('Invalid workout preferences response');
  return parsed;
}

/** GET-only query; focus/reconnect must never replay writes or migration. */
export function workoutPreferencesQueryOptions(scope: Scope) {
  return queryOptions({
    queryKey: accountQueryKeys.workoutPreferences(scope.accountId),
    queryFn: async ({ signal }) => {
      const response = await scopedApi(scope, signal).GET(path, { signal });
      return confirmed(scope, response.response.status, response.data, signal);
    },
    retry: shouldRetryMobileRead,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

/** Explicit mutation transport. The caller owns serialization, cache invalidation
 * and GET-only reconciliation after ambiguous errors; no offline mutation queue. */
export async function writeWorkoutPreferences(
  scope: Scope,
  kind: 'initialize' | 'update',
  body: WorkoutPreferencePatch,
) {
  assertCurrent(scope);
  if (!onlineManager.isOnline()) throw new Error('Workout preference write requires connectivity');
  const api = scopedApi(scope);
  const response =
    kind === 'initialize'
      ? await api.POST(initializePath, { body })
      : await api.PATCH(path, { body });
  return confirmed(scope, response.response.status, response.data);
}
