'use client';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readInbox, markRead, type InboxFilters } from '../api/inbox';
import { inboxKeys, sessionKey, useTrainerInboxSession } from './inbox-session';

export function useTrainerInbox(filters: InboxFilters) {
  const session = useTrainerInboxSession();
  const { owner, active, handleError } = session;
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: inboxKeys.list(owner ?? 'signed-out', filters),
    queryFn: ({ pageParam, signal }) => readInbox(owner!, filters, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: active,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  const mutation = useMutation({
    mutationFn: (id?: string) => {
      if (!active || !owner || document.visibilityState !== 'visible')
        throw new Error('Inactive Inbox');
      return markRead(owner, id);
    },
    onSettled: async (_result, error) => {
      handleError(error);
      if (owner && client.getQueryData(sessionKey) === owner)
        await client.invalidateQueries({ queryKey: inboxKeys.owner(owner) });
    },
    retry: false,
    networkMode: 'always',
  });
  return { query, mutation, session };
}
