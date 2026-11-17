import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { paths } from '@gym/api-client';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

export type WorkoutDetails =
  paths['/workouts/{id}']['get']['responses'][200]['content']['application/json'];

export type WorkoutTransition = 'start' | 'complete';

import { MobileSessionExpiredError, shouldRetryMobileRead } from '@/shared/api/api-error-policy';

export function useWorkoutDetailsQuery(workoutId: string) {
  const { account, getApi, signOut } = useAuth();

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
      if (response.response.status === 401) {
        await signOut();
        throw new MobileSessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити тренування.');
      }
      return response.data;
    },
    retry: shouldRetryMobileRead,
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

      if (response.response.status === 401) {
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
