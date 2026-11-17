import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import type { ProgressRange } from '@/features/progress/model/workout-summary-query';
import { accountQueryKeys } from '@/shared/api/query-client';

class SessionExpiredError extends Error {}
class AccessDeniedError extends Error {}

/** Exercise analytics are never shared between accounts or exercise identifiers. */
export function useExerciseProgress(exerciseId: string, range: ProgressRange) {
  const { account, getApi, signOut } = useAuth();

  return useQuery({
    queryKey: [
      ...accountQueryKeys.all,
      account?.id ?? 'signed-out',
      'exercise-progress',
      exerciseId,
      range,
    ],
    enabled: account?.role === 'ATHLETE' && Boolean(exerciseId),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Немає доступу до API.');

      const response = await api.GET('/workout-analytics/exercises/{exerciseId}', {
        params: { path: { exerciseId }, query: { range } },
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
        throw new Error('Не вдалося завантажити прогрес вправи.');
      }
      return response.data;
    },
    retry: (count, error) =>
      !(error instanceof SessionExpiredError || error instanceof AccessDeniedError) && count < 1,
  });
}
