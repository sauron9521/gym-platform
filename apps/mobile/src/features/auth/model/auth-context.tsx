import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { paths } from '@gym/api-client';
import { useQueryClient } from '@tanstack/react-query';

import { createMobileApi } from '@/shared/api/client';
import { accountQueryKeys } from '@/shared/api/query-client';
import { getMobileLoginError, validateMobileCredentials } from '../lib/login-flow';

export type Account = paths['/users/me']['get']['responses'][200]['content']['application/json'];
type TokenPair = { accessToken: string; refreshToken: string };
type Result = { success: true } | { success: false; message: string };
type AuthValue = {
  account: Account | null;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  getApi: () => ReturnType<typeof createMobileApi> | null;
};
const AuthContext = createContext<AuthValue | null>(null);

/** Temporary native-auth slice: access and refresh tokens are never persisted. */
export function AuthProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  const queryClient = useQueryClient();
  const tokens = useRef<TokenPair | null>(null);
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  const getApi = useCallback(() => {
    if (!baseUrl) return null;
    try {
      return createMobileApi(baseUrl, () => tokens.current?.accessToken ?? null);
    } catch {
      return null;
    }
  }, [baseUrl]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      const validation = validateMobileCredentials(email, password);
      if (validation) return { success: false, message: validation };
      const api = getApi();
      if (!api) return { success: false, message: 'Налаштуйте EXPO_PUBLIC_API_URL.' };

      let issuedRefreshToken: string | null = null;
      let verified = false;
      try {
        const issued = await api.POST('/auth/token', {
          body: { email: email.trim(), password },
        });
        if (issued.response.status !== 200 || !issued.data) {
          return { success: false, message: getMobileLoginError(issued.response.status) };
        }

        tokens.current = {
          accessToken: issued.data.accessToken,
          refreshToken: issued.data.refreshToken,
        };
        issuedRefreshToken = issued.data.refreshToken;

        // Token issuance alone must not unlock protected navigation.
        const me = await api.GET('/users/me');
        if (me.response.status !== 200 || !me.data) {
          return { success: false, message: 'Не вдалося підтвердити вхід.' };
        }
        queryClient.clear();
        queryClient.setQueryData(accountQueryKeys.me(me.data.id), me.data);
        setAccount(me.data);
        verified = true;
        return { success: true };
      } catch {
        return { success: false, message: 'Немає з’єднання з API.' };
      } finally {
        if (!verified) {
          tokens.current = null;
          setAccount(null);
          if (issuedRefreshToken) {
            try {
              await api.POST('/auth/token/revoke', {
                body: { refreshToken: issuedRefreshToken },
              });
            } catch {
              // Best effort: no credential is retained locally.
            }
          }
        }
      }
    },
    [getApi, queryClient],
  );

  const signOut = useCallback(async () => {
    const api = getApi();
    const refreshToken = tokens.current?.refreshToken;
    tokens.current = null;
    queryClient.clear();
    setAccount(null);
    if (api && refreshToken) {
      try {
        await api.POST('/auth/token/revoke', { body: { refreshToken } });
      } catch {
        // Local session has already been discarded.
      }
    }
  }, [getApi, queryClient]);

  const value = useMemo(
    () => ({ account, signIn, signOut, getApi }),
    [account, signIn, signOut, getApi],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
