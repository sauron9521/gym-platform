import { AppState } from 'react-native';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { createMobileApi } from '@/shared/api/client';
import { accountQueryKeys } from '@/shared/api/query-client';
import {
  hasMobileAccess,
  parseAccountCapabilities,
  type AccountCapabilities,
} from './account-capabilities';
import type { MobileTokenSession } from './mobile-token-session';
import type { Account } from './auth-context';
import type { PrivateDataLifecycle } from './private-data-lifecycle';

type LifecycleOptions = {
  session: MobileTokenSession;
  privateData: PrivateDataLifecycle;
  getApi: () => ReturnType<typeof createMobileApi> | null;
  queryClient: QueryClient;
  setAccount: Dispatch<SetStateAction<Account | null>>;
  setCapabilities: Dispatch<SetStateAction<AccountCapabilities | null>>;
  setRecoveryAvailable: Dispatch<SetStateAction<boolean>>;
};

export function useAuthBootstrap({
  baseUrl,
  privateData,
  session,
  getApi,
  queryClient,
  setAccount,
  setCapabilities,
  setRecoveryAvailable,
  setRestoring,
}: LifecycleOptions & {
  baseUrl: string | undefined;
  setRestoring: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        if (!baseUrl) return;
        const initialRevision = session.revision;
        const restored = await session.restore();
        if (!active) return;
        if (!restored) {
          // No persisted credential (or an already-invalidated restore).
          // Transient failures throw instead; do not delete their drafts.
          if (session.revision === initialRevision) void privateData.end();
          return;
        }

        const revision = session.revision;
        const api = getApi();
        if (!api) return;
        const response = await api.GET('/users/me');
        if (!active || session.revision !== revision) return;

        if (response.response.status === 200 && response.data) {
          const grantResult = await api.GET('/users/me/capabilities');
          if (!active || session.revision !== revision) return;
          const grants =
            grantResult.response.status === 200 ? parseAccountCapabilities(grantResult.data) : null;
          if (grants && hasMobileAccess(grants)) {
            queryClient.clear();
            queryClient.setQueryData(accountQueryKeys.me(response.data.id), response.data);
            void privateData.verified(response.data.id, grants);
            setCapabilities(grants);
            setAccount(response.data);
            setRecoveryAvailable(false);
          } else if (
            grantResult.response.status === 401 ||
            grantResult.response.status === 403 ||
            (grants && !hasMobileAccess(grants))
          ) {
            void privateData.end();
            await session.clear();
            setCapabilities(null);
            setRecoveryAvailable(false);
          } else if (session.canRevalidate()) {
            // Keep the rotated token after transient errors, but private
            // navigation stays locked until both account and grants verify.
            setRecoveryAvailable(true);
          }
        } else if (response.response.status === 401 || response.response.status === 403) {
          void privateData.end();
          await session.clear();
          setCapabilities(null);
          setRecoveryAvailable(false);
        } else if (
          active &&
          (response.response.status === 408 ||
            response.response.status === 429 ||
            response.response.status >= 500) &&
          session.canRevalidate()
        ) {
          setRecoveryAvailable(true);
        }
        // A transient network/5xx error keeps the newly rotated refresh token
        // in SecureStore for the next launch; never unlock without verification.
      } catch {
        // A failed profile check after a successful rotation may be retried
        // with the same in-memory access token, without replaying refresh.
        if (active && session.canRevalidate()) setRecoveryAvailable(true);
      } finally {
        if (active) setRestoring(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [
    baseUrl,
    privateData,
    getApi,
    queryClient,
    session,
    setAccount,
    setCapabilities,
    setRecoveryAvailable,
    setRestoring,
  ]);
}

export function useAuthForeground({
  account,
  privateData,
  session,
  getApi,
  queryClient,
  setAccount,
  setCapabilities,
  setRecoveryAvailable,
}: LifecycleOptions & { account: Account | null }) {
  // Revalidate persisted grants on foreground; old roles and cached claims
  // are never enough to unlock a privileged navigation stack.
  useEffect(() => {
    let alive = true;
    let checkGeneration = 0;
    const revalidate = async () => {
      if (!account) return;
      const currentCheck = ++checkGeneration;
      const revision = session.revision;
      privateData.lock();
      setCapabilities(null);
      queryClient.clear();
      try {
        const api = getApi();
        if (!api) throw new Error('Mobile API unavailable');
        const response = await api.GET('/users/me/capabilities');
        if (!alive || currentCheck !== checkGeneration || session.revision !== revision) return;
        const grants =
          response.response.status === 200 ? parseAccountCapabilities(response.data) : null;
        if (grants && hasMobileAccess(grants)) {
          // Backgrounding clears private queries. Restore the verified account
          // marker before unlocking screens so workout GET reconciliation can run.
          // This is an existing account snapshot, not a fresh profile response.
          queryClient.setQueryData(accountQueryKeys.me(account.id), account, { updatedAt: 0 });
          void privateData.verified(account.id, grants);
          setCapabilities(grants);
          return;
        }
        if (
          response.response.status === 401 ||
          response.response.status === 403 ||
          (grants && !hasMobileAccess(grants))
        ) {
          void privateData.end();
          await session.clear();
          if (!alive || currentCheck !== checkGeneration) return;
          setRecoveryAvailable(false);
          setCapabilities(null);
          setAccount(null);
          return;
        } else {
          setRecoveryAvailable(session.canRevalidate());
        }
      } catch {
        if (!alive || currentCheck !== checkGeneration || session.revision !== revision) return;
        setRecoveryAvailable(session.canRevalidate());
      }
      if (alive && currentCheck === checkGeneration && session.revision === revision) {
        setCapabilities(null);
        setAccount(null);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        ++checkGeneration;
        privateData.lock();
        if (!account) return;
        setCapabilities(null);
        queryClient.clear();
      } else if (state === 'active') {
        void revalidate();
      }
    });
    return () => {
      alive = false;
      ++checkGeneration;
      subscription.remove();
    };
  }, [
    account,
    getApi,
    privateData,
    queryClient,
    session,
    setAccount,
    setCapabilities,
    setRecoveryAvailable,
  ]);
}
