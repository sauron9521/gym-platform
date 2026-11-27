'use client';

import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInbox, fetchUnread, markInboxRead, type InboxFilters } from '../api/inbox';
import { inboxKeys, useInboxSession } from './inbox-session';

export function useUnreadInbox() {
  const session = useInboxSession();
  const owner = session.owner ?? '';
  const { handleError } = session;
  const query = useQuery({
    queryKey: inboxKeys.count(owner),
    queryFn: ({ signal }) => fetchUnread(owner, signal),
    enabled: session.active,
    retry: false,
    gcTime: 0,
    refetchInterval: session.active ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    handleError(query.error);
  }, [query.error, handleError]);
  return { count: session.active && query.isSuccess ? query.data : undefined };
}

export function useInboxList(filters: InboxFilters) {
  const session = useInboxSession();
  const owner = session.owner ?? '';
  const { handleError } = session;
  const query = useInfiniteQuery({
    queryKey: inboxKeys.list(owner, filters),
    queryFn: ({ pageParam, signal }) => fetchInbox(owner, filters, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: session.active,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id?: string) => {
      if (!session.active) throw new Error('Inactive inbox session');
      return markInboxRead(owner, id);
    },
    onSettled: async (_data, error) => {
      session.handleError(error);
      // Server remains authoritative, including an ambiguous write response.
      await client.invalidateQueries({ queryKey: inboxKeys.owner(owner) });
    },
    retry: false,
  });
  useEffect(() => {
    handleError(query.error);
  }, [query.error, handleError]);
  return { query, mutation, session };
}
