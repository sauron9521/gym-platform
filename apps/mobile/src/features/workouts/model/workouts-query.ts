import { useInfiniteQuery } from '@tanstack/react-query';
import type { paths } from '@gym/api-client';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

export type WorkoutFilter = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | undefined;

export type WorkoutsPage =
  paths['/workouts']['get']['responses'][200]['content']['application/json'];

class SessionExpiredError extends Error {}

export function nextWorkoutPage(page: { meta: { totalPages: number } }, current: number) {
  return current < page.meta.totalPages ? current + 1 : undefined;
}

/** Paginated results are scoped by authenticated account and selected status. */
export function useWorkoutsQuery(status?: WorkoutFilter) {
  const { account, getApi, signOut } = useAuth();

  return useInfiniteQuery({
    queryKey: [...accountQueryKeys.workouts(account?.id ?? 'signed-out'), status ?? 'ALL'],
    enabled: Boolean(account),
    initialPageParam: 1,
    queryFn: async ({ signal, pageParam }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');

      const response = await api.GET('/workouts', {
        params: { query: { page: pageParam, limit: 20, view: 'summary', status } },
        signal,
      });

      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Термін сесії минув. Увійдіть повторно.');
      }

      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити тренування.');
      }

      return response.data;
    },
    getNextPageParam: (page, _pages, lastPageParam) => nextWorkoutPage(page, lastPageParam),
    retry: (count, error) => !(error instanceof SessionExpiredError) && count < 1,
  });
}
