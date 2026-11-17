import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

class SessionExpired extends Error {}
export function useTrainerAthletes() {
  const { account, getApi, signOut } = useAuth();
  return useInfiniteQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'trainer-athletes', 'ACTIVE'],
    enabled: account?.role === 'TRAINER',
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано API.');
      const response = await api.GET('/trainer-athletes', {
        params: { query: { page: pageParam, limit: 20, status: 'ACTIVE' } },
        signal,
      });
      if (response.response.status === 401) { await signOut(); throw new SessionExpired('Сесію завершено.'); }
      if (response.response.status === 403) throw new Error('Список доступний лише тренерам.');
      if (response.response.status !== 200 || !response.data) throw new Error('Не вдалося завантажити підопічних.');
      return response.data;
    },
    getNextPageParam: (page, _pages, last) => last < page.meta.totalPages ? last + 1 : undefined,
    retry: (count, error) => !(error instanceof SessionExpired) && count < 1,
  });
}
