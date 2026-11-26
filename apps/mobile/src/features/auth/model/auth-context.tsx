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

import type { MobileAuthErrorCode } from '@/shared/i18n/mobile-messages';
import { createMobileApi } from '@/shared/api/client';
import {
  hasMobileAccess,
  parseAccountCapabilities,
  type AccountCapabilities,
} from './account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';
import {
  getMobileLoginError,
  getMobileLoginTransportError,
  validateMobileCredentials,
} from '../lib/login-flow';
import { MobileTokenSession } from './mobile-token-session';
import { refreshTokenStore } from './refresh-token-store';
import { useAuthBootstrap, useAuthForeground } from './use-auth-lifecycle';
import { noPrivateDataLifecycle, type PrivateDataLifecycle } from './private-data-lifecycle';

export type Account = paths['/users/me']['get']['responses'][200]['content']['application/json'];
type Result = { success: true } | { success: false; code: MobileAuthErrorCode };
type AuthValue = {
  account: Account | null;
  capabilities: AccountCapabilities | null;
  restoring: boolean;
  recoveryAvailable: boolean;
  retryVerification: () => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  getApi: () => ReturnType<typeof createMobileApi> | null;
};
const AuthContext = createContext<AuthValue | null>(null);

/**
 * Access tokens are memory-only. A single-use refresh token is persisted only
 * on native platforms, rotated serially, and verified with GET /users/me.
 */
export function AuthProvider({
  children,
  privateData = noPrivateDataLifecycle,
}: PropsWithChildren<{ privateData?: PrivateDataLifecycle }>) {
  const [account, setAccount] = useState<Account | null>(null);
  const [capabilities, setCapabilities] = useState<AccountCapabilities | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  // The composition root supplies one stable private-data lifecycle instance.
  useEffect(() => () => privateData.lock(), [privateData]);
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
          void privateData.end();
          queryClient.clear();
          setAccount(null);
          setCapabilities(null);
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

  // Use a non-rotating token reader for manual post-startup verification.
  const getVerificationApi = useCallback(() => {
    if (!baseUrl) return null;
    try {
      return createMobileApi(baseUrl, () => session.getRevalidationToken());
    } catch {
      return null;
    }
  }, [baseUrl, session]);

  useAuthBootstrap({
    baseUrl,
    session,
    getApi,
    queryClient,
    setAccount,
    setCapabilities,
    setRecoveryAvailable,
    setRestoring,
    privateData,
  });

  const retryVerification = useCallback(async (): Promise<Result> => {
    if (!recoveryAvailable || !session.canRevalidate()) {
      setRecoveryAvailable(false);
      return { success: false, code: 'sessionExpired' };
    }
    const api = getVerificationApi();
    if (!api) return { success: false, code: 'apiUnavailable' };

    const revision = session.revision;
    try {
      const result = await api.GET('/users/me');
      if (session.revision !== revision) {
        return { success: false, code: 'sessionChanged' };
      }
      if (result.response.status === 200 && result.data) {
        const grantResult = await api.GET('/users/me/capabilities');
        if (session.revision !== revision) {
          return { success: false, code: 'sessionChanged' };
        }
        const grants =
          grantResult.response.status === 200 ? parseAccountCapabilities(grantResult.data) : null;
        if (grants && hasMobileAccess(grants)) {
          queryClient.clear();
          queryClient.setQueryData(accountQueryKeys.me(result.data.id), result.data);
          void privateData.verified(result.data.id, grants);
          setCapabilities(grants);
          setAccount(result.data);
          setRecoveryAvailable(false);
          return { success: true };
        }
        if (
          grantResult.response.status === 401 ||
          grantResult.response.status === 403 ||
          (grants && !hasMobileAccess(grants))
        ) {
          void privateData.end();
          await session.clear();
          setCapabilities(null);
          setRecoveryAvailable(false);
        }
      } else if (result.response.status === 401 || result.response.status === 403) {
        void privateData.end();
        await session.clear();
        setCapabilities(null);
        setRecoveryAvailable(false);
      }
      return { success: false, code: 'sessionVerificationFailed' };
    } catch {
      // Retain the rotated refresh token; never retry the one-time refresh call.
      return { success: false, code: 'connectionFailed' };
    }
  }, [getVerificationApi, privateData, queryClient, recoveryAvailable, session]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (restoring) return { success: false, code: 'restoring' };
      const validation = validateMobileCredentials(email, password);
      if (validation) return { success: false, code: validation };

      const guestApi = getGuestApi();
      const api = getApi();
      if (!guestApi || !api) {
        return { success: false, code: 'apiUnavailable' };
      }

      privateData.lock();
      setRecoveryAvailable(false);
      let issuedRefreshToken: string | null = null;
      let verified = false;
      let stage: 'issue' | 'persist' | 'verify' = 'issue';
      try {
        const issued = await guestApi.POST('/auth/token', {
          body: { email: email.trim(), password },
        });
        if (issued.response.status !== 200 || !issued.data) {
          return { success: false, code: getMobileLoginError(issued.response.status) };
        }
        issuedRefreshToken = issued.data.refreshToken;

        stage = 'persist';
        if (!(await session.accept(issued.data))) {
          return { success: false, code: 'storageFailed' };
        }

        // Never unlock based only on token issuance or SecureStore contents.
        stage = 'verify';
        const revision = session.revision;
        const me = await api.GET('/users/me');
        if (me.response.status !== 200 || !me.data || session.revision !== revision) {
          return { success: false, code: 'verificationFailed' };
        }

        const grantResult = await api.GET('/users/me/capabilities');
        if (session.revision !== revision || grantResult.response.status !== 200) {
          return { success: false, code: 'permissionsFailed' };
        }
        const grants = parseAccountCapabilities(grantResult.data);
        if (!grants || !hasMobileAccess(grants)) {
          return { success: false, code: 'mobileAccessDenied' };
        }

        queryClient.clear();
        queryClient.setQueryData(accountQueryKeys.me(me.data.id), me.data);
        void privateData.verified(me.data.id, grants);
        setCapabilities(grants);
        setAccount(me.data);
        verified = true;
        return { success: true };
      } catch {
        // Identify the failed step without exposing credentials or raw exceptions.
        return { success: false, code: getMobileLoginTransportError(stage) };
      } finally {
        if (!verified) {
          void privateData.end();
          await session.clear().catch(() => undefined);
          queryClient.clear();
          setAccount(null);
          setCapabilities(null);
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
    [getApi, getGuestApi, privateData, queryClient, restoring, session],
  );

  const signOut = useCallback(async () => {
    const refreshToken = session.currentRefreshToken;
    const guestApi = getGuestApi();
    const cleanup = privateData.end();
    queryClient.clear();
    setAccount(null);
    setCapabilities(null);
    setRecoveryAvailable(false);
    await session.clear().catch(() => undefined);
    if (guestApi && refreshToken) {
      try {
        await guestApi.POST('/auth/token/revoke', { body: { refreshToken } });
      } catch {
        // The local credential is discarded before remote revocation.
      }
    }
    await cleanup;
  }, [getGuestApi, privateData, queryClient, session]);

  useAuthForeground({
    account,
    session,
    getApi,
    queryClient,
    setAccount,
    setCapabilities,
    setRecoveryAvailable,
    privateData,
  });

  const value = useMemo(
    () => ({
      account,
      capabilities,
      restoring,
      recoveryAvailable,
      retryVerification,
      signIn,
      signOut,
      getApi,
    }),
    [
      account,
      capabilities,
      restoring,
      recoveryAvailable,
      retryVerification,
      signIn,
      signOut,
      getApi,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
