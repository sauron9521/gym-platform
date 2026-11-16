import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';

export type ProgressRange = '7d' | '30d' | '90d';

export function useWorkoutSummary(range: ProgressRange) {
  const { account, getApi, signOut } = useAuth();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'workout-summary', range],
    enabled: Boolean(account),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/workout-analytics/summary', {
        params: { query: { range } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити статистику.');
      }
      return response.data;
    },
  });
}
