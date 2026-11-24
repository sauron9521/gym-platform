import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import {
  isSessionExpired,
  mobileReadError,
  MobileSessionExpiredError,
  shouldRetryMobileRead,
} from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';
import { nextWorkoutPage } from '../lib/workouts-pagination';

export type WorkoutFilter = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | undefined;

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

      if (isSessionExpired(response.response.status)) {
        await signOut();
        throw new MobileSessionExpiredError('Термін сесії минув. Увійдіть повторно.');
      }

      if (response.response.status !== 200 || !response.data) {
        throw mobileReadError(response.response.status, 'Не вдалося завантажити тренування.');
      }

      return response.data;
    },
    getNextPageParam: (page, _pages, lastPageParam) => nextWorkoutPage(page, lastPageParam),
    retry: shouldRetryMobileRead,
  });
}
