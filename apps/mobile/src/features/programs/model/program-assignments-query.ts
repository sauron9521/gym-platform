import { useRef } from 'react';
import {
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { nextAssignmentPage } from '@/features/programs/lib/assignment-pagination';
import { accountQueryKeys } from '@/shared/api/query-client';
import {
  clearProgramWorkoutAttempt,
  getProgramWorkoutAttempt,
} from '../lib/program-workout-attempt';

class SessionExpiredError extends Error {}

function useProgramsApi() {
  const { account, capabilities, getApi, signOut } = useAuth();
  return { account, capabilities, getApi, signOut };
}

export function useProgramAssignments() {
  const { account, capabilities, getApi, signOut } = useProgramsApi();
  return useInfiniteQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'program-assignments'],
    enabled: hasAthleteAccess(capabilities),
    initialPageParam: 1,
    queryFn: async ({ signal, pageParam }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/training-programs/assignments', {
        params: { query: { page: pageParam, limit: 20, status: 'ACTIVE', view: 'summary' } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити програми.');
      }
      return response.data;
    },
    getNextPageParam: (page, _pages, lastPageParam) =>
      nextAssignmentPage(lastPageParam, page.meta.totalPages),
    retry: (count, error) => !(error instanceof SessionExpiredError) && count < 1,
  });
}

export function useProgramAssignment(id: string) {
  const { account, capabilities, getApi, signOut } = useProgramsApi();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'program-assignment', id],
    enabled: hasAthleteAccess(capabilities) && Boolean(id),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/training-programs/assignments/{assignmentId}', {
        params: { path: { assignmentId: id } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося відкрити програму.');
      }
      return response.data;
    },
    retry: (count, error) => !(error instanceof SessionExpiredError) && count < 1,
  });
}

export function useCreateWorkoutFromProgram(assignmentId: string) {
  const { account, capabilities, getApi, signOut } = useProgramsApi();
  const queryClient = useQueryClient();
  const attempts = useRef(new Map<string, string>());
  return useMutation({
    mutationFn: async (programWorkoutId: string) => {
      if (!onlineManager.isOnline()) throw new Error('Немає мережі. Тренування не створено.');
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      if (!hasAthleteAccess(capabilities)) {
        throw new Error('Створення тренувань із програми доступне лише спортсмену.');
      }
      const key = getProgramWorkoutAttempt(
        attempts.current,
        assignmentId,
        programWorkoutId,
        () => `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      );
      const response = await api.POST('/workouts/from-program', {
        body: { assignmentId, programWorkoutId },
        headers: { 'Idempotency-Key': key },
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 201 || !response.data) {
        throw new Error(
          response.response.status === 409
            ? 'Тренування вже створено або програма неактивна.'
            : 'Не вдалося створити тренування.',
        );
      }
      return response.data;
    },
    onSuccess: (_workout, programWorkoutId) => {
      // A successful POST permits a deliberate second creation with a new key.
      clearProgramWorkoutAttempt(attempts.current, assignmentId, programWorkoutId);
      if (account) {
        void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
      }
    },
    networkMode: 'always',
    retry: false,
  });
}
