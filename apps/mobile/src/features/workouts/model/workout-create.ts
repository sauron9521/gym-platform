import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

import {
  buildMobileWorkoutBody,
  resolveWorkoutCreationAttempt,
  type CreateOneWorkout,
  type WorkoutCreationAttempt,
} from '../lib/create-workout-schema';

export function useCreateMobileWorkout() {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  const attempt = useRef<WorkoutCreationAttempt | null>(null);
  return useMutation({
    mutationFn: async (input: CreateOneWorkout): Promise<string> => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      if (!account || account.role !== 'ATHLETE') {
        throw new Error('Створення власного тренування доступне лише спортсмену.');
      }
      // Retain the key after a timeout: a manual retry must not create a duplicate.
      attempt.current = resolveWorkoutCreationAttempt(
        input,
        attempt.current,
        () => `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      );
      const response = await api.POST('/workouts', {
        headers: { 'Idempotency-Key': attempt.current.key },
        body: buildMobileWorkoutBody(input),
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 201 || !response.data) {
        throw new Error('Не вдалося створити тренування. Перевірте дані та доступ до вправи.');
      }
      return response.data.id;
    },
    onSuccess: () => {
      // Cache invalidation must never turn a successful POST into a mutation error.
      if (account) {
        void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
      }
    },
    retry: false,
  });
}
