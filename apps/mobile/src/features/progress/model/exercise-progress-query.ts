import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';
import type { ProgressRange } from './workout-summary-query';

class SessionExpired extends Error {}
class AccessDenied extends Error {}

export function useExerciseProgress(exerciseId: string, range: ProgressRange) {
  const { account, getApi, signOut } = useAuth();
  return useQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'exercise-progress', exerciseId, range],
    enabled: account?.role === 'ATHLETE' && Boolean(exerciseId),
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано API.');
      const response = await api.GET('/workout-analytics/exercises/{exerciseId}', {
        params: { path: { exerciseId }, query: { range } },
        signal,
      });
      if (response.response.status === 401) {
        await signOut();
        throw new SessionExpired('Сесію завершено.');
      }
      if (response.response.status === 403) {
        throw new AccessDenied('Аналітика доступна лише спортсменам.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося завантажити прогрес вправи.');
      }
      return response.data;
    },
    retry: (count, error) => !(error instanceof SessionExpired || error instanceof AccessDenied) && count < 1,
  });
}
