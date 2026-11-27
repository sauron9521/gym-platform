import { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import {
  captureInboxScope,
  readInbox,
  readUnread,
  writeRead,
  type InboxFilters,
} from '../services/inbox-api';

export const inboxKeys = {
  owner: (id: string) => ['account', id, 'notifications'] as const,
  count: (id: string) => [...inboxKeys.owner(id), 'count'] as const,
  list: (id: string, filters: InboxFilters) => [...inboxKeys.owner(id), 'list', filters] as const,
};

export function useInboxScope() {
  const { account, capabilities, getScopedApi, signOut } = useAuth();
  const client = useQueryClient();
  return useMemo(
    () =>
      account && capabilities && hasAthleteAccess(capabilities)
        ? captureInboxScope(client, account.id, capabilities, { getScopedApi, signOut })
        : null,
    [account, capabilities, client, getScopedApi, signOut],
  );
}

export function useInboxCount() {
  const scope = useInboxScope();
  const owner = scope?.ownerId ?? 'signed-out';
  const client = useQueryClient();
  const query = useQuery({
    queryKey: inboxKeys.count(owner),
    enabled: !!scope,
    queryFn: ({ signal }) => readUnread(scope!, signal),
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  useFocusEffect(
    useCallback(() => {
      if (scope?.isCurrent())
        void client.invalidateQueries(
          { queryKey: inboxKeys.count(owner) },
          { cancelRefetch: false },
        );
    }, [client, owner, scope]),
  );
  return {
    count: scope?.isCurrent() && query.isSuccess && !query.isFetching ? query.data : undefined,
  };
}

export function useInboxList(filters: InboxFilters) {
  const scope = useInboxScope();
  const owner = scope?.ownerId ?? 'signed-out';
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: inboxKeys.list(owner, filters),
    enabled: !!scope,
    queryFn: ({ pageParam, signal }) => readInbox(scope!, filters, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  useFocusEffect(
    useCallback(() => {
      if (scope?.isCurrent())
        void client.invalidateQueries(
          { queryKey: inboxKeys.owner(owner) },
          { cancelRefetch: false },
        );
    }, [client, owner, scope]),
  );
  const mutation = useMutation({
    mutationFn: (id?: string) => {
      if (!scope) throw new Error('Inbox unavailable');
      return writeRead(scope, id);
    },
    retry: false,
    networkMode: 'always',
    onSettled: async () => {
      if (scope?.isCurrent()) await client.invalidateQueries({ queryKey: inboxKeys.owner(owner) });
    },
  });
  return { query, mutation, scope };
}
