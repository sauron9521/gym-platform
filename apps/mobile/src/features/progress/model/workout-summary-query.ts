import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';

export type ProgressRange = '7d' | '30d' | '90d';

class SessionExpiredError extends Error {}
class AccessDeniedError extends Error {}

export function useWorkoutSummary(range: ProgressRange) {
  const { account, capabilities, getApi, signOut } = useAuth();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'workout-summary', range],
    enabled: hasAthleteAccess(capabilities),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');
      const response = await api.GET('/workout-analytics/summary', {
        params: { query: { range } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpiredError('Сесію завершено.');
      }
      if (response.response.status === 403) {
        throw new AccessDeniedError('Аналітика доступна лише спортсменам.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити статистику.');
      }
      return response.data;
    },
    retry: (count, error) =>
      !(error instanceof SessionExpiredError || error instanceof AccessDeniedError) && count < 1,
  });
}
