import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { workoutTitleError } from '@/features/workouts/lib/workout-edit-policy';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';
import { isSessionExpired, MobileSessionExpiredError } from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';

/**
 * Isolate writes by the verified account and cancel in-flight detail reads
 * before updating the cache, so older GET responses do not restore stale data.
 */
function useWorkoutWriteContext(workoutId: string) {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();

  const apiForWrite = () => {
    if (!account || account.role !== 'ATHLETE') {
      throw new Error('Змінювати тренування може лише спортсмен.');
    }
    if (!onlineManager.isOnline()) {
      throw new Error('Немає мережі. Дію не надіслано.');
    }
    const api = getApi();
    if (!api) throw new Error('Не налаштовано адресу API.');
    return api;
  };

  const assertSession = async (status: number) => {
    if (!isSessionExpired(status)) return;
    await signOut();
    throw new MobileSessionExpiredError('Сесію завершено.');
  };

  const updateCache = async (workout: WorkoutDetails) => {
    if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
    const detailKey = accountQueryKeys.workoutDetail(account.id, workoutId);
    await queryClient.cancelQueries({ queryKey: detailKey });
    // A sign-out may have cleared the cache while cancelQueries was awaiting.
    if (!queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
    queryClient.setQueryData(detailKey, workout);
    void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
  };

  return { apiForWrite, assertSession, updateCache };
}

export function useUpdateWorkoutTitle(workoutId: string) {
  const { apiForWrite, assertSession, updateCache } = useWorkoutWriteContext(workoutId);

  return useMutation({
    mutationFn: async (title: string): Promise<WorkoutDetails> => {
      const error = workoutTitleError(title);
      if (error) throw new Error(error);
      const api = apiForWrite();
      const response = await api.PATCH('/workouts/{id}', {
        params: { path: { id: workoutId } },
        body: { title: title.trim() },
      });
      await assertSession(response.response.status);
      if (response.response.status !== 200 || !response.data) {
        throw new Error(
          response.response.status === 400 || response.response.status === 409
            ? 'Редагувати можна лише заплановане тренування.'
            : 'Не вдалося змінити назву тренування.',
        );
      }
      return response.data;
    },
    onSuccess: updateCache,
    networkMode: 'always',
    retry: false,
  });
}

export function useCancelWorkout(workoutId: string) {
  const { apiForWrite, assertSession, updateCache } = useWorkoutWriteContext(workoutId);

  return useMutation({
    mutationFn: async (): Promise<WorkoutDetails> => {
      const api = apiForWrite();
      const response = await api.POST('/workouts/{id}/cancel', {
        params: { path: { id: workoutId } },
      });
      await assertSession(response.response.status);
      if (response.response.status !== 200 || !response.data) {
        throw new Error(
          response.response.status === 400 || response.response.status === 409
            ? 'Тренування більше не можна скасувати.'
            : 'Не вдалося скасувати тренування.',
        );
      }
      return response.data;
    },
    onSuccess: updateCache,
    networkMode: 'always',
    retry: false,
  });
}
