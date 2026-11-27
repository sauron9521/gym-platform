'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { InboxError, unreadCount } from '../api/inbox';

export const inboxKeys = {
  owner: (owner: string) => ['admin-inbox', owner] as const,
  count: (owner: string) => ['admin-inbox', owner, 'count'] as const,
  list: (owner: string, unread: boolean, cursor: string | null) =>
    ['admin-inbox', owner, 'list', unread, cursor] as const,
};
export function available() {
  return document.visibilityState === 'visible' && navigator.onLine;
}
function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    document.removeEventListener('visibilitychange', callback);
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
const serverAvailable = () => false;
type Session = {
  owner: string;
  active: boolean;
  count: number | undefined;
  canOpen: boolean;
  blocked: boolean;
  unavailable: boolean;
  assertActive: () => void;
  handleError: (error: unknown) => void;
  refresh: () => Promise<void>;
};
const Context = createContext<Session | null>(null);

function Boundary({ owner, children }: { owner: string; children: ReactNode }) {
  const client = useQueryClient();
  const shown = useSyncExternalStore(subscribe, available, serverAvailable);
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  const active = shown && !blocked;
  const assertActive = useCallback(() => {
    if (blockedRef.current || !available()) throw new InboxError();
  }, []);
  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof InboxError) || ![401, 403, 409].includes(error.status ?? 0)) return;
      if (blockedRef.current) return;
      blockedRef.current = true;
      setBlocked(true);
      void client.cancelQueries({ queryKey: inboxKeys.owner(owner) });
      client.removeQueries({ queryKey: inboxKeys.owner(owner) });
    },
    [client, owner],
  );
  const count = useQuery({
    queryKey: inboxKeys.count(owner),
    queryFn: ({ signal }) => {
      assertActive();
      return unreadCount(owner, signal);
    },
    enabled: active,
    retry: false,
    gcTime: 0,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const refresh = useCallback(async () => {
    if (blockedRef.current || !available()) return;
    await client.invalidateQueries({ queryKey: inboxKeys.owner(owner) }, { cancelRefetch: false });
  }, [client, owner]);
  useEffect(() => {
    if (!shown) {
      void client.cancelQueries({ queryKey: inboxKeys.owner(owner) });
      client.removeQueries({ queryKey: inboxKeys.owner(owner) });
    } else if (active) void refresh();
  }, [shown, active, client, owner, refresh]);
  useEffect(() => {
    const focus = () => {
      if (available()) void refresh();
    };
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    return () => {
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', focus);
    };
  }, [refresh]);
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'error' &&
          event.query.queryKey[0] === 'admin-inbox' &&
          event.query.queryKey[1] === owner
        )
          handleError(event.action.error);
      }),
    [client, owner, handleError],
  );

  return (
    <Context.Provider
      value={{
        owner,
        active,
        blocked,
        count: active && count.isSuccess && !count.isFetching ? count.data : undefined,
        canOpen: active && count.isSuccess,
        unavailable: !shown || count.isError,
        assertActive,
        handleError,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
function OwnerProvider({ owner, children }: { owner: string; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
  );
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return (
    <QueryClientProvider client={client}>
      <Boundary owner={owner}>{children}</Boundary>
    </QueryClientProvider>
  );
}
export function AdminInboxProvider({ owner, children }: { owner: string; children: ReactNode }) {
  return (
    <OwnerProvider key={owner} owner={owner}>
      {children}
    </OwnerProvider>
  );
}
export function useInboxSession() {
  const session = useContext(Context);
  if (!session) throw new Error('Missing AdminInboxProvider');
  return session;
}
