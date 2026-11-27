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
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { InboxError, readOwner, unreadCount } from '../api/inbox';

export const sessionKey = ['trainer-inbox-session'] as const;
export const inboxKeys = {
  all: ['trainer-inbox'] as const,
  owner: (owner: string) => ['trainer-inbox', owner] as const,
  count: (owner: string) => ['trainer-inbox', owner, 'count'] as const,
  list: (owner: string, filters: object) => ['trainer-inbox', owner, 'list', filters] as const,
};
function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}
const visible = () => document.visibilityState === 'visible';
const serverVisible = () => false;
type Session = {
  owner: string | null;
  active: boolean;
  failed: boolean;
  count: number | undefined;
  canOpen: boolean;
  retry: () => void;
  handleError: (error: unknown) => void;
};
const Context = createContext<Session | null>(null);

function SessionBoundary({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const shown = useSyncExternalStore(subscribe, visible, serverVisible);
  const [ended, setEnded] = useState(false);
  const [blockedOwner, setBlockedOwner] = useState<string | null>(null);
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => readOwner(signal),
    enabled: shown && !ended,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const owner = session.isSuccess && !ended ? session.data : null;
  const blocked = !!owner && owner === blockedOwner;
  const active = shown && !!owner && !blocked && !session.isFetching;
  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof InboxError) || !owner || client.getQueryData(sessionKey) !== owner)
        return;
      if (error.status === 401) {
        setEnded(true);
        client.clear();
        return;
      }
      if ((error.status === 403 || error.status === 409) && owner && !blocked) {
        setBlockedOwner(owner);
        void client.cancelQueries({ queryKey: inboxKeys.owner(owner) });
        if (error.status === 409)
          void client.invalidateQueries({ queryKey: sessionKey, exact: true });
      }
    },
    [client, owner, blocked],
  );
  const count = useQuery({
    queryKey: inboxKeys.count(owner ?? 'signed-out'),
    queryFn: ({ signal }) => unreadCount(owner!, signal),
    enabled: active,
    retry: false,
    gcTime: 0,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  useEffect(() => {
    const end = () => {
      setEnded(true);
      client.clear();
    };
    window.addEventListener('trainer-session-ended', end);
    return () => window.removeEventListener('trainer-session-ended', end);
  }, [client]);
  useEffect(() => {
    if (!shown) {
      void client.cancelQueries({ queryKey: inboxKeys.all });
      client.removeQueries({ queryKey: inboxKeys.all });
    } else if (active)
      void client.invalidateQueries(
        { queryKey: inboxKeys.owner(owner!) },
        { cancelRefetch: false },
      );
  }, [shown, active, owner, client]);
  useEffect(() => {
    const recheck = () => {
      if (visible() && active)
        void client.invalidateQueries(
          { queryKey: inboxKeys.owner(owner!) },
          { cancelRefetch: false },
        );
    };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [active, owner, client]);
  useEffect(() => {
    client.removeQueries({
      queryKey: inboxKeys.all,
      predicate: (query) => blocked || query.queryKey[1] !== owner,
    });
  }, [client, owner, blocked]);
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'error' &&
          event.query.queryKey[0] === inboxKeys.all[0] &&
          event.query.queryKey[1] === owner
        ) {
          handleError(event.action.error);
        }
      }),
    [client, owner, handleError],
  );
  const failed = ended || session.isError || blocked;
  return (
    <Context.Provider
      value={{
        owner,
        active,
        failed,
        canOpen: active && count.isSuccess,
        count: active && count.isSuccess && !count.isFetching ? count.data : undefined,
        retry: () => {
          if (!shown) return;
          setEnded(false);
          setBlockedOwner(null);
          void session.refetch();
        },
        handleError,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function TrainerInboxProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionBoundary>{children}</SessionBoundary>
    </QueryClientProvider>
  );
}
export function useTrainerInboxSession() {
  const session = useContext(Context);
  if (!session) throw new Error('Missing TrainerInboxProvider');
  return session;
}
