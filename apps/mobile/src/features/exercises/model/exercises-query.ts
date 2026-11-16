import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

export type ExerciseFilters = {
  search: string;
  muscleGroup?: string;
  equipment?: string;
};

export function useExerciseFilters() {
  const { account, getApi } = useAuth();
  const scope = [...accountQueryKeys.all, account?.id ?? 'signed-out', 'exercise-filters'];

  const muscleGroups = useQuery({
    queryKey: [...scope, 'muscle-groups'],
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/exercises/muscle-groups', { signal });
      if (response.response.status !== 200 || !response.data)
        throw new Error('Не вдалося завантажити групи м’язів.');
      return response.data;
    },
  });
  const equipment = useQuery({
    queryKey: [...scope, 'equipment'],
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/exercises/equipment', { signal });
      if (response.response.status !== 200 || !response.data)
        throw new Error('Не вдалося завантажити обладнання.');
      return response.data;
    },
  });
  return { muscleGroups, equipment };
}

export function useExercisesQuery(filters: ExerciseFilters) {
  const { account, getApi, signOut } = useAuth();
  return useInfiniteQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'exercises', filters],
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
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data)
        throw new Error('Не вдалося завантажити вправи.');
      return response.data;
    },
    getNextPageParam: (page, _pages, index) =>
      index < page.meta.totalPages ? index + 1 : undefined,
  });
}
