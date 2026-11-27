'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { profileQueryOptions, ProfileRequestError } from '@/features/profile/api/profile-query';
import { InboxRequestError } from '../api/inbox';

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
  const options = profileQueryOptions();
  // Share the canonical profile cache with the locale switcher and editor.
  // The authenticated Inbox header fences every request, including writes.
  const profile = useQuery({
    ...options,
    enabled: shown,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const owner = profile.isSuccess && profile.data.role !== 'ADMIN' ? profile.data.id : null;
  const [blockedOwner, setBlockedOwner] = useState<string | null>(null);
  const blocked = !!owner && blockedOwner === owner;
  const active = shown && !!owner && !blocked && !profile.isFetching;
  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof InboxRequestError || error instanceof ProfileRequestError)) return;
      if (error.status === 401) {
        onAuthFailure(error);
        return;
      }
      if (
        error instanceof InboxRequestError &&
        (error.status === 403 || error.status === 409) &&
        owner &&
        blockedOwner !== owner
      ) {
        setBlockedOwner(owner);
        void client.cancelQueries({ queryKey: inboxKeys.owner(owner) });
        if (error.status === 409)
          void client.invalidateQueries({ queryKey: profileQueryOptions().queryKey, exact: true });
      }
    },
    [client, onAuthFailure, owner, blockedOwner],
  );

  useEffect(() => {
    const recheck = () => {
      if (!visible() || !owner || blocked) return;
      void client.invalidateQueries({ queryKey: inboxKeys.owner(owner) }, { cancelRefetch: false });
    };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [client, owner, blocked]);

  useEffect(() => {
    if (!shown) void client.cancelQueries({ queryKey: inboxKeys.all });
  }, [client, shown]);

  useEffect(() => {
    client.removeQueries({
      queryKey: inboxKeys.all,
      predicate: (query) => query.queryKey[1] !== owner || blocked,
    });
  }, [client, owner, blocked]);

  useEffect(() => {
    handleError(profile.error);
  }, [profile.error, handleError]);

  return (
    <Context.Provider
      value={{
        owner,
        active,
        failed: profile.isError || blocked || (profile.isSuccess && !owner),
        retry: () => {
          if (shown) {
            setBlockedOwner(null);
            void profile.refetch();
          }
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
