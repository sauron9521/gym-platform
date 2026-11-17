import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import type { paths } from '@gym/api-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

type WorkoutDetails = paths['/workouts/{id}']['get']['responses'][200]['content']['application/json'];

function useWorkoutEditApi(workoutId: string) {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  const checkOnline = () => { if (!onlineManager.isOnline()) throw new Error('Немає мережі.'); };
  const updateCache = async (workout: WorkoutDetails) => {
    if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
    queryClient.setQueryData(accountQueryKeys.workoutDetail(account.id, workoutId), workout);
    await queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
  };
  return { getApi, signOut, checkOnline, updateCache };
}

export function useUpdateWorkoutTitle(workoutId: string) {
  const { getApi, signOut, checkOnline, updateCache } = useWorkoutEditApi(workoutId);
  return useMutation({
    mutationFn: async (title: string): Promise<WorkoutDetails> => {
      const trimmed = title.trim();
      if (trimmed.length < 2 || trimmed.length > 120) throw new Error('Назва: 2–120 символів.');
      checkOnline();
      const api = getApi();
      if (!api) throw new Error('Не налаштовано API.');
      const response = await api.PATCH('/workouts/{id}', { params: { path: { id: workoutId } }, body: { title: trimmed } });
      if (response.response.status === 401) { await signOut(); throw new Error('Сесію завершено.'); }
      if (response.response.status !== 200 || !response.data) throw new Error('Не вдалося змінити назву.');
      return response.data;
    },
    onSuccess: updateCache,
    networkMode: 'always',
    retry: false,
  });
}

export function useCancelWorkout(workoutId: string) {
  const { getApi, signOut, checkOnline, updateCache } = useWorkoutEditApi(workoutId);
  return useMutation({
    mutationFn: async (): Promise<WorkoutDetails> => {
      checkOnline();
      const api = getApi();
      if (!api) throw new Error('Не налаштовано API.');
      const response = await api.POST('/workouts/{id}/cancel', { params: { path: { id: workoutId } } });
      if (response.response.status === 401) { await signOut(); throw new Error('Сесію завершено.'); }
      if (response.response.status !== 200 || !response.data) {
        throw new Error(response.response.status === 409 ? 'Тренування більше не можна скасувати.' : 'Помилка скасування тренування.');
      }
      return response.data;
    },
    onSuccess: updateCache,
    networkMode: 'always',
    retry: false,
  });
}
