import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';
import { nextExercisePage } from '../lib/exercises-pagination';

export type ExerciseFilters = {
  search: string;
  muscleGroup?: string;
  equipment?: string;
};

class SessionExpiredError extends Error {}

/** Taxonomy reads are independently cached per signed-in user. */
export function useExerciseFilters() {
  const { account, getApi, signOut } = useAuth();
  const scope = [...accountQueryKeys.all, account?.id ?? 'signed-out', 'exercise-filters'];
  const enabled = Boolean(account);
  const retry = (count: number, error: Error) =>
    !(error instanceof SessionExpiredError) && count < 1;

  const muscleGroups = useQuery({
    queryKey: [...scope, 'muscle-groups'],
    enabled,
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/exercises/muscle-groups', { signal });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити групи м’язів.');
      }
      return response.data;
    },
    retry,
  });
  const equipment = useQuery({
    queryKey: [...scope, 'equipment'],
    enabled,
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/exercises/equipment', { signal });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити обладнання.');
      }
      return response.data;
    },
    retry,
  });
  return { muscleGroups, equipment };
}

/** Search and taxonomy filters use separate account-scoped infinite-query caches. */
export function useExercisesQuery(filters: ExerciseFilters) {
  const { account, getApi, signOut } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      ...accountQueryKeys.all,
      account?.id ?? 'signed-out',
      'exercises',
      filters.search,
      filters.muscleGroup ?? 'all-muscles',
      filters.equipment ?? 'all-equipment',
    ],
    enabled: Boolean(account),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/exercises', {
        params: {
          query: {
            page: pageParam,
            limit: 20,
            search: filters.search || undefined,
            muscleGroup: filters.muscleGroup,
            equipment: filters.equipment,
          },
        },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити вправи.');
      }
      return response.data;
    },
    getNextPageParam: (page, _pages, lastPageParam) =>
      nextExercisePage(page.meta.totalPages, lastPageParam),
    retry: (count, error) => !(error instanceof SessionExpiredError) && count < 1,
  });
}
