import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasTrainerAccess } from '@/features/auth/model/account-capabilities';
import {
  isSessionExpired,
  mobileReadError,
  MobileSessionExpiredError,
  shouldRetryMobileRead,
} from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';

/** Trainer-only active relationships, scoped to the currently authenticated account. */
export function useTrainerAthletes() {
  const { account, capabilities, getApi, signOut } = useAuth();

  return useInfiniteQuery({
    queryKey: [...accountQueryKeys.all, account?.id ?? 'signed-out', 'trainer-athletes', 'ACTIVE'],
    enabled: hasTrainerAccess(capabilities),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');

      const response = await api.GET('/trainer-athletes', {
        params: { query: { page: pageParam, limit: 20, status: 'ACTIVE' } },
        signal,
      });

      if (isSessionExpired(response.response.status)) {
        await signOut();
        throw new MobileSessionExpiredError('Термін сесії минув. Увійдіть повторно.');
      }

      if (response.response.status !== 200 || !response.data) {
        throw mobileReadError(response.response.status, 'Не вдалося завантажити підопічних.');
      }

      return response.data;
    },
    getNextPageParam: (page, _pages, lastPageParam) =>
      lastPageParam < page.meta.totalPages ? lastPageParam + 1 : undefined,
    retry: shouldRetryMobileRead,
  });
}
