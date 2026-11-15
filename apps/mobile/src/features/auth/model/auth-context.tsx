import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { paths } from '@gym/api-client';
import { useQueryClient } from '@tanstack/react-query';

import { createMobileApi } from '@/shared/api/client';
import { accountQueryKeys } from '@/shared/api/query-client';
import { getMobileLoginError, validateMobileCredentials } from '../lib/login-flow';
import { MobileTokenSession } from './mobile-token-session';
import { refreshTokenStore } from './refresh-token-store';

export type Account = paths['/users/me']['get']['responses'][200]['content']['application/json'];
type Result = { success: true } | { success: false; message: string };
type AuthValue = {
  account: Account | null;
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  getApi: () => ReturnType<typeof createMobileApi> | null;
};
const AuthContext = createContext<AuthValue | null>(null);

/**
 * Access tokens are memory-only. A single-use refresh token is persisted only
 * on native platforms, rotated serially, and verified with GET /users/me.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  const [restoring, setRestoring] = useState(true);
  const queryClient = useQueryClient();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  const getGuestApi = useCallback(() => {
    if (!baseUrl) return null;
    try {
      return createMobileApi(baseUrl, () => null);
    } catch {
      return null;
    }
  }, [baseUrl]);

  const [session] = useState(
    () =>
      new MobileTokenSession(
        refreshTokenStore,
        async (refreshToken) => {
          const api = getGuestApi();
          if (!api) throw new Error('Mobile API is not configured.');
          const response = await api.POST('/auth/token/refresh', {
            body: { refreshToken },
          });
          if (response.response.status === 401 || response.response.status === 403) return null;
          if (response.response.status !== 200 || !response.data) {
            throw new Error('Could not rotate refresh token.');
          }
          return response.data;
        },
        async (refreshToken) => {
          const api = getGuestApi();
          if (api) await api.POST('/auth/token/revoke', { body: { refreshToken } });
        },
        () => {
          // Expired or replayed refresh tokens invalidate all private UI state.
          queryClient.clear();
          setAccount(null);
        },
      ),
  );

  const getApi = useCallback(() => {
    if (!baseUrl) return null;
    try {
      return createMobileApi(baseUrl, () => session.getAccessToken());
    } catch {
      return null;
    }
  }, [baseUrl, session]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        if (!baseUrl) return;
        if (!(await session.restore()) || !active) return;

        const revision = session.revision;
        const api = getApi();
        if (!api) return;
        const response = await api.GET('/users/me');
        if (!active || session.revision !== revision) return;

        if (response.response.status === 200 && response.data) {
          queryClient.clear();
          queryClient.setQueryData(accountQueryKeys.me(response.data.id), response.data);
          setAccount(response.data);
        } else if (response.response.status === 401) {
          await session.clear();
        }
        // A transient network/5xx error keeps the newly rotated refresh token
        // in SecureStore for the next launch; never unlock without verification.
      } catch {
        // Storage locked/unavailable or API offline: keep protected routes closed.
      } finally {
        if (active) setRestoring(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [baseUrl, getApi, queryClient, session]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (restoring) return { success: false, message: 'Зачекайте на перевірку сесії.' };
      const validation = validateMobileCredentials(email, password);
      if (validation) return { success: false, message: validation };

      const guestApi = getGuestApi();
      const api = getApi();
      if (!guestApi || !api) {
        return { success: false, message: 'Налаштуйте EXPO_PUBLIC_API_URL.' };
      }

      let issuedRefreshToken: string | null = null;
      let verified = false;
      try {
        const issued = await guestApi.POST('/auth/token', {
          body: { email: email.trim(), password },
        });
        if (issued.response.status !== 200 || !issued.data) {
          return { success: false, message: getMobileLoginError(issued.response.status) };
        }
        issuedRefreshToken = issued.data.refreshToken;

        if (!(await session.accept(issued.data))) {
          return { success: false, message: 'Не вдалося зберегти сесію.' };
        }

        // Never unlock based only on token issuance or SecureStore contents.
        const revision = session.revision;
        const me = await api.GET('/users/me');
        if (me.response.status !== 200 || !me.data || session.revision !== revision) {
          return { success: false, message: 'Не вдалося підтвердити вхід.' };
        }

        queryClient.clear();
        queryClient.setQueryData(accountQueryKeys.me(me.data.id), me.data);
        setAccount(me.data);
        verified = true;
        return { success: true };
      } catch {
        return { success: false, message: 'Не вдалося увійти або захистити сесію.' };
      } finally {
        if (!verified) {
          await session.clear().catch(() => undefined);
          queryClient.clear();
          setAccount(null);
          if (issuedRefreshToken) {
            try {
              await guestApi.POST('/auth/token/revoke', {
                body: { refreshToken: issuedRefreshToken },
              });
            } catch {
              // Best effort. Nothing is deliberately retained in local memory.
            }
          }
        }
      }
    },
    [getApi, getGuestApi, queryClient, restoring, session],
  );

  const signOut = useCallback(async () => {
    const refreshToken = session.currentRefreshToken;
    const guestApi = getGuestApi();
    queryClient.clear();
    setAccount(null);
    await session.clear().catch(() => undefined);
    if (guestApi && refreshToken) {
      try {
        await guestApi.POST('/auth/token/revoke', { body: { refreshToken } });
      } catch {
        // The local credential is discarded before remote revocation.
      }
    }
  }, [getGuestApi, queryClient, session]);

  const value = useMemo(
    () => ({ account, restoring, signIn, signOut, getApi }),
    [account, restoring, signIn, signOut, getApi],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
