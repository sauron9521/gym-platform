import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { operations } from '@gym/api-client';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

export type CreateWorkoutBody =
  operations['WorkoutsController_create']['requestBody']['content']['application/json'];

type CreateOneWorkout = {
  title: string;
  exerciseId: string;
  plannedReps: number;
};

export function buildMobileWorkoutBody(input: CreateOneWorkout): CreateWorkoutBody {
  return {
    title: input.title.trim(),
    exercises: [
      {
        exerciseId: input.exerciseId,
        sets: [{ setType: 'WORKING', plannedReps: input.plannedReps }],
      },
    ],
  };
}

export function useWorkoutExerciseOptions() {
  const { account, getApi, signOut } = useAuth();
  return useQuery({
    queryKey: ['account', 'create-workout-exercises', account?.id ?? 'signed-out'],
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      const response = await api.GET('/exercises', {
        params: { query: { page: 1, limit: 20 } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити вправи.');
      }
      return response.data.data.filter((item) => !item.isArchived);
    },
    retry: false,
  });
}

export function useCreateMobileWorkout() {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOneWorkout): Promise<string> => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      const response = await api.POST('/workouts', { body: buildMobileWorkoutBody(input) });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 201 || !response.data) {
        throw new Error('Не вдалося створити тренування. Перевірте дані та доступ до вправи.');
      }
      return response.data.id;
    },
    onSuccess: async () => {
      if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
    },
    retry: false,
  });
}
