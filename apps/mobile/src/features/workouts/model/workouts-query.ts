import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

class SessionExpiredError extends Error {}

/** Read-only paginated workout list; credentials never enter TanStack keys. */
export function useWorkoutsQuery() {
  const { account, getApi, signOut } = useAuth();

  return useQuery({
    queryKey: accountQueryKeys.workouts(account?.id ?? 'signed-out'),
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');

      const response = await api.GET('/workouts', {
        params: { query: { page: 1, limit: 20, view: 'summary' } },
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
    retry: (count, error) => !(error instanceof SessionExpiredError) && count < 1,
  });
}
