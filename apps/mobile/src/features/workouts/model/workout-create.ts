import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';

import {
  buildMobileWorkoutBody,
  buildMobileMultiWorkoutBody,
  resolveMultiWorkoutCreationAttempt,
  resolveWorkoutCreationAttempt,
  type CreateOneWorkout,
  type MobileMultiWorkoutForm,
  mobileMultiWorkoutFormSchema,
  type WorkoutCreationAttempt,
} from '../lib/create-workout-schema';

export function useCreateMobileWorkout() {
  const { account, capabilities, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  const attempt = useRef<WorkoutCreationAttempt | null>(null);
  return useMutation({
    mutationFn: async (input: CreateOneWorkout): Promise<string> => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      if (!account || !hasAthleteAccess(capabilities)) {
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

/** Multi-exercise POST with explicit idempotency and no automatic mutation retry. */
export function useCreateMultiMobileWorkout() {
  const { account, capabilities, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  const attempt = useRef<WorkoutCreationAttempt | null>(null);

  return useMutation({
    mutationFn: async (form: MobileMultiWorkoutForm): Promise<string> => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');
      if (!account || !hasAthleteAccess(capabilities)) {
        throw new Error('Створення тренування доступне лише спортсмену.');
      }
      // Prevent invalid programmatic calls from bypassing the RHF/Zod form.
      const validForm = mobileMultiWorkoutFormSchema.parse(form);
      attempt.current = resolveMultiWorkoutCreationAttempt(
        validForm,
        attempt.current,
        () => `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      );
      const response = await api.POST('/workouts', {
        headers: { 'Idempotency-Key': attempt.current.key },
        body: buildMobileMultiWorkoutBody(validForm),
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 201 || !response.data) {
        throw new Error('Не вдалося створити тренування. Перевірте вправи та підходи.');
      }
      attempt.current = null;
      return response.data.id;
    },
    onSuccess: () => {
      // Keep successful POST unaffected by background query-cache refresh failures.
      if (account) {
        void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
      }
    },
    retry: false,
  });
}
