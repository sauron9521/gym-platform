import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return useQuery({
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
      return response.data;
    },
    retry: shouldRetryMobileRead,
    // Always read canonical state after native background/foreground and reconnect,
    // even inside the default 30-second cache stale window. This is GET-only.
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useWorkoutTransition(workoutId: string) {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transition: WorkoutTransition): Promise<WorkoutDetails> => {
      if (!onlineManager.isOnline()) throw new Error('Немає мережі. Дію не надіслано.');
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      const params = { path: { id: workoutId } };
      const response =
        transition === 'start'
          ? await api.POST('/workouts/{id}/start', { params })
          : await api.POST('/workouts/{id}/complete', { params });

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
    onSuccess: async (workout) => {
      // Sign-out clears the verified account cache. An in-flight response must
      // never restore private workout data after the session was cleared.
      if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
      queryClient.setQueryData(accountQueryKeys.workoutDetail(account.id, workoutId), workout);
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
    },
    networkMode: 'always',
    retry: false,
  });
}
