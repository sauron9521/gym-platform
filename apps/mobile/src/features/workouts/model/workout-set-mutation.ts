import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { paths } from '@gym/api-client';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';
import type { WorkoutDetails } from './workout-details-query';

export class WorkoutSetRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Забагато запитів. Зачекайте перед повторним збереженням.');
    this.name = 'WorkoutSetRateLimitError';
  }
}

type SetBody =
  paths['/workouts/{id}/sets/{setId}']['patch']['requestBody']['content']['application/json'];
type SetResponse =
  paths['/workouts/{id}/sets/{setId}']['patch']['responses'][200]['content']['application/json'];

export function useWorkoutSetMutation(workoutId: string) {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ setId, body }: { setId: string; body: SetBody }): Promise<SetResponse> => {
      if (!onlineManager.isOnline()) throw new Error('Немає мережі. Підхід не надіслано.');
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      const response = await api.PATCH('/workouts/{id}/sets/{setId}', {
        params: { path: { id: workoutId, setId } },
        body,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено. Увійдіть повторно.');
      }
      if (response.response.status === 429) {
        const retryAfter = Number(response.response.headers.get('retry-after'));
        throw new WorkoutSetRateLimitError(
          Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60,
        );
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error(
          response.response.status === 409
            ? 'Неможливо зберегти підхід у поточному стані тренування.'
            : 'Не вдалося зберегти підхід.',
        );
      }
      return response.data;
    },
    networkMode: 'always',
    onSuccess: async (updated) => {
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      }
      if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
      // Do not let a concurrently completing stale GET overwrite the server's
      // successful PATCH response after app resume. GET supports abort signals.
      await queryClient.cancelQueries({
        queryKey: accountQueryKeys.workoutDetail(account.id, workoutId),
        exact: true,
      });
      // Account could be revoked while the cancellation promise is in flight.
      if (!queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
      queryClient.setQueryData<WorkoutDetails>(
        accountQueryKeys.workoutDetail(account.id, workoutId),
        (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.map((exercise) => ({
                  ...exercise,
                  sets: exercise.sets.map((set) => (set.id === updated.id ? updated : set)),
                })),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
    },
    retry: false,
  });
}
