import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import {
  isSessionExpired,
  mobileReadError,
  MobileSessionExpiredError,
  shouldRetryMobileRead,
} from '@/shared/api/api-error-policy';
import { accountQueryKeys } from '@/shared/api/query-client';

/** Typed GET /users/me, scoped per account and skipped for signed-out users. */
export function useAccountQuery() {
  const { account, getApi, signOut } = useAuth();

  return useQuery({
    queryKey: accountQueryKeys.me(account?.id ?? 'signed-out'),
    enabled: Boolean(account),
    initialData: account ?? undefined,
    queryFn: async ({ signal }) => {
      const api = getApi();
      if (!api) throw new Error('Не налаштовано адресу API.');

      const response = await api.GET('/users/me', { signal });
      if (isSessionExpired(response.response.status)) {
        // Only an actual 401 ends the session. Network/5xx errors preserve credentials.
        await signOut();
        throw new MobileSessionExpiredError('Термін сесії минув. Увійдіть повторно.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw mobileReadError(response.response.status, 'Не вдалося завантажити профіль.');
      }

      return response.data;
    },
    retry: shouldRetryMobileRead,
  });
}
