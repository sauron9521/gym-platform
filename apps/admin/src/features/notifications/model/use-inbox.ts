'use client';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { markRead, readInbox } from '../api/inbox';
import { available, inboxKeys, useInboxSession } from './inbox-session';

export function useAdminInbox() {
  const session = useInboxSession();
  const [unread, setUnread] = useState(false);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const lock = useRef(false);
  const cursor = cursors.at(-1) ?? null;
  const query = useQuery({
    queryKey: inboxKeys.list(session.owner, unread, cursor),
    queryFn: ({ signal }) => {
      session.assertActive();
      return readInbox(session.owner, cursor, unread, signal);
    },
    enabled: session.active && session.canOpen,
    retry: false,
    gcTime: 0,
    refetchInterval: session.active ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (id?: string) => {
      session.assertActive();
      return markRead(session.owner, id);
    },
    onSettled: async (_data, error) => {
      session.handleError(error);
      // No optimistic mutation and no replay. Reconcile by authorized GET.
      await session.refresh();
    },
    retry: false,
    networkMode: 'always',
  });
  async function read(id?: string) {
    if (
      !session.active ||
      !session.canOpen ||
      !available() ||
      lock.current ||
      query.isFetching ||
      !query.isSuccess
    )
      return;
    lock.current = true;
    try {
      await mutation.mutateAsync(id);
    } catch {
      /* localized state below */
    } finally {
      lock.current = false;
    }
  }
  const data =
    session.active && session.canOpen && query.isSuccess && !query.isFetching
      ? query.data
      : undefined;
  return {
    session,
    query,
    mutation,
    data,
    unread,
    read,
    filter: (value: boolean) => {
      setUnread(value);
      setCursors([null]);
      mutation.reset();
    },
    previous: () => setCursors((values) => (values.length > 1 ? values.slice(0, -1) : values)),
    next: () => {
      if (data?.nextCursor && !cursors.includes(data.nextCursor))
        setCursors((values) => [...values, data.nextCursor]);
    },
    hasPrevious: cursors.length > 1,
  };
}
