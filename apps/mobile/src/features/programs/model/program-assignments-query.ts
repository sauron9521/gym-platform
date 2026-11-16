import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

function useProgramsApi() {
  const { account, getApi, signOut } = useAuth();
  return { account, getApi, signOut };
}

export function useProgramAssignments() {
  const { account, getApi, signOut } = useProgramsApi();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'program-assignments'],
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/training-programs/assignments', {
        params: { query: { page: 1, limit: 20, status: 'ACTIVE', view: 'summary' } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити програми.');
      }
      return response.data;
    },
  });
}

export function useProgramAssignment(id: string) {
  const { account, getApi, signOut } = useProgramsApi();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'program-assignment', id],
    enabled: Boolean(account && id),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/training-programs/assignments/{assignmentId}', {
        params: { path: { assignmentId: id } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося відкрити програму.');
      }
      return response.data;
    },
  });
}

export function useCreateWorkoutFromProgram(assignmentId: string) {
  const { account, getApi, signOut } = useProgramsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (programWorkoutId: string) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.POST('/workouts/from-program', {
        body: { assignmentId, programWorkoutId },
        headers: { 'Idempotency-Key': `mobile-${assignmentId}-${programWorkoutId}-${Date.now()}` },
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
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
    onSuccess: () => {
      if (!account || !queryClient.getQueryData(accountQueryKeys.me(account.id))) return;
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.workouts(account.id) });
    },
    retry: false,
  });
}
