import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type MutateOptions,
} from '@tanstack/react-query';
import type { paths } from '@gym/api-client';

import { useAuth } from '@/features/auth/model/auth-context';
import {
  isSessionExpired,
  mobileReadError,
  MobileSessionExpiredError,
  shouldRetryMobileRead,
} from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';
import { reconcileWorkoutOnFocus } from './workout-reconciliation';

export type WorkoutDetails =
  paths['/workouts/{id}']['get']['responses'][200]['content']['application/json'];

export type WorkoutTransition = 'start' | 'complete';

export function useWorkoutDetailsQuery(workoutId: string) {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      void reconcileWorkoutOnFocus(queryClient, account?.id ?? null, workoutId).catch(
        () => undefined,
      );
    }, [queryClient, account?.id, workoutId]),
  );

  const query = useQuery({
    queryKey: accountQueryKeys.workoutDetail(account?.id ?? 'signed-out', workoutId),
    enabled: Boolean(account && workoutId),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      const response = await api.GET('/workouts/{id}', {
        params: { path: { id: workoutId } },
        signal,
      });
      if (isSessionExpired(response.response.status)) {
        await signOut();
        throw new MobileSessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw mobileReadError(response.response.status, 'Не вдалося завантажити тренування.');
      }
      // Increment only for a successful canonical GET. A PATCH cache update
      // must never satisfy the proof required after an ambiguous write.
      if (
        !signal.aborted &&
        account?.id &&
        queryClient.getQueryData(accountQueryKeys.me(account.id))
      ) {
        queryClient.setQueryData<number>(
          accountQueryKeys.workoutDetailRead(account.id, workoutId),
          (previous) => (previous ?? 0) + 1,
        );
      }
      return response.data;
    },
    retry: shouldRetryMobileRead,
    // Always read canonical state after native background/foreground and reconnect,
    // even inside the default 30-second cache stale window. This is GET-only.
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  return {
    ...query,
    captureCompletionGuard() {
      return captureWorkoutCompletionGuard(
        queryClient,
        account?.id,
        workoutId,
        query.data,
        query.dataUpdatedAt,
      );
    },
    canonicalReadVersion: account?.id
      ? (queryClient.getQueryData<number>(
          accountQueryKeys.workoutDetailRead(account.id, workoutId),
        ) ?? 0)
      : 0,
  };
}

/** Snapshot identity and read proof are captured at review time. A refreshed,
 * removed or replaced session/cache entry requires a new explicit review. */
export function captureWorkoutCompletionGuard(
  client: QueryClient,
  accountId: string | undefined,
  workoutId: string,
  snapshot: WorkoutDetails | undefined,
  updatedAt: number,
) {
  const markerKey = accountQueryKeys.me(accountId ?? 'signed-out');
  const detailKey = accountQueryKeys.workoutDetail(accountId ?? 'signed-out', workoutId);
  const readKey = accountQueryKeys.workoutDetailRead(accountId ?? 'signed-out', workoutId);
  const marker = client.getQueryCache().find({ queryKey: markerKey, exact: true });
  const entry = client.getQueryCache().find({ queryKey: detailKey, exact: true });
  const version = client.getQueryData<number>(readKey);
  return () => {
    const state = client.getQueryState<WorkoutDetails>(detailKey);
    return Boolean(
      accountId &&
      marker &&
      entry &&
      snapshot?.athleteId === accountId &&
      snapshot.id === workoutId &&
      snapshot.status === 'IN_PROGRESS' &&
      client.getQueryData(markerKey) &&
      client.getQueryCache().find({ queryKey: markerKey, exact: true }) === marker &&
      client.getQueryCache().find({ queryKey: detailKey, exact: true }) === entry &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      state.data === snapshot &&
      state.dataUpdatedAt === updatedAt &&
      client.getQueryData<number>(readKey) === version,
    );
  };
}

type TransitionRequest = {
  action: WorkoutTransition;
  accountId: string;
  workoutId: string;
  isCurrent: () => boolean;
  canSend?: () => boolean;
};

export function useWorkoutTransition(workoutId: string) {
  const { account, getScopedApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  const markerKey = accountQueryKeys.me(account?.id ?? 'signed-out');
  const marker = queryClient.getQueryCache().find({ queryKey: markerKey, exact: true });
  const current = () =>
    Boolean(
      account &&
      marker &&
      queryClient.getQueryData(markerKey) &&
      queryClient.getQueryCache().find({ queryKey: markerKey, exact: true }) === marker,
    );

  const mutation = useMutation({
    mutationFn: async ({
      action,
      workoutId,
      isCurrent,
      canSend,
    }: TransitionRequest): Promise<WorkoutDetails> => {
      if (!onlineManager.isOnline()) throw new Error('Немає мережі. Дію не надіслано.');
      const allowed = () => isCurrent() && onlineManager.isOnline() && (canSend?.() ?? true);
      if (!allowed()) throw new Error('Стан тренування змінився. Перевірте підходи повторно.');
      const api = getScopedApi(allowed);
      if (!api || !allowed()) throw new Error('Сесія або стан тренування змінилися.');
      const params = { path: { id: workoutId } };
      const response =
        action === 'start'
          ? await api.POST('/workouts/{id}/start', { params })
          : await api.POST('/workouts/{id}/complete', { params });

      if (!isCurrent()) throw new Error('Сесія змінилася.');
      if (isSessionExpired(response.response.status)) {
        await signOut();
        throw new MobileSessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error(
          response.response.status === 409
            ? 'Неможливо змінити статус. Перевірте стан підходів.'
            : 'Не вдалося змінити статус тренування.',
        );
      }
      return response.data;
    },
    onSuccess: async (workout, request) => {
      // The request carries its original marker, even if observer options
      // change after a same-ID sign-in while the response is in flight.
      if (!request.isCurrent()) return;
      queryClient.setQueryData(
        accountQueryKeys.workoutDetail(request.accountId, request.workoutId),
        workout,
      );
      await queryClient.invalidateQueries({
        queryKey: accountQueryKeys.workouts(request.accountId),
      });
    },
    networkMode: 'always',
    retry: false,
  });

  return {
    ...mutation,
    mutate(
      action: WorkoutTransition,
      options?: MutateOptions<WorkoutDetails, Error, TransitionRequest> & {
        canSend?: () => boolean;
      },
    ) {
      const { canSend, ...callbacks } = options ?? {};
      mutation.mutate(
        { action, accountId: account?.id ?? 'signed-out', workoutId, isCurrent: current, canSend },
        callbacks,
      );
    },
  };
}
