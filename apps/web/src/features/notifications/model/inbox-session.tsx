'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { currentInboxOwner, InboxRequestError } from '../api/inbox';

const sessionKey = ['inbox-session'] as const;
export const inboxKeys = {
  all: ['inbox'] as const,
  owner: (owner: string) => ['inbox', owner] as const,
  count: (owner: string) => ['inbox', owner, 'count'] as const,
  list: (owner: string, filters: object) => ['inbox', owner, 'list', filters] as const,
};

function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}
function visible() {
  return document.visibilityState === 'visible';
}
function serverVisible() {
  return false;
}

type Session = {
  owner: string | null;
  active: boolean;
  failed: boolean;
  retry: () => void;
  handleError: (error: unknown) => void;
};
const Context = createContext<Session | null>(null);

export function InboxSessionBoundary({ children }: { children: ReactNode }) {
  const shown = useSyncExternalStore(subscribe, visible, serverVisible);
  const client = useQueryClient();
  const onAuthFailure = useAuthFailure();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => currentInboxOwner(signal),
    enabled: shown,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const owner = session.isSuccess ? session.data : null;
  const active = shown && !!owner && !session.isFetching;
  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof InboxRequestError)) return;
      if (error.accountChanged || error.status === 401 || error.status === 403) {
        if (error.status === 401) onAuthFailure(error);
        else if (error.accountChanged) void client.invalidateQueries({ queryKey: sessionKey });
        else client.setQueryData(sessionKey, null);
      }
    },
    [client, onAuthFailure],
  );

  useEffect(() => {
    const recheck = () => {
      if (!visible()) return;
      const previous = client.getQueryData<string>(sessionKey);
      void client
        .refetchQueries({ queryKey: sessionKey, type: 'active' }, { cancelRefetch: false })
        .then(() => {
          if (
            visible() &&
            previous &&
            client.getQueryState(sessionKey)?.status === 'success' &&
            client.getQueryData(sessionKey) === previous
          ) {
            return client.invalidateQueries(
              { queryKey: inboxKeys.owner(previous) },
              { cancelRefetch: false },
            );
          }
        });
    };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [client]);

  useEffect(() => {
    if (!shown) {
      void client.cancelQueries({ queryKey: inboxKeys.all });
      void client.cancelQueries({ queryKey: sessionKey });
    }
  }, [client, shown]);

  useEffect(() => {
    client.removeQueries({
      queryKey: inboxKeys.all,
      predicate: (query) => query.queryKey[1] !== owner,
    });
  }, [client, owner]);

  useEffect(() => {
    handleError(session.error);
  }, [session.error, handleError]);

  return (
    <Context.Provider
      value={{
        owner,
        active,
        failed: session.isError || (session.isSuccess && !owner),
        retry: () => {
          if (shown) void session.refetch();
        },
        handleError,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useInboxSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing InboxSessionBoundary');
  return value;
}
