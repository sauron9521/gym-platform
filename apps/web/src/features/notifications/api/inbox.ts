import type { operations } from '@gym/api-client';
import { webApi } from '@/shared/api/client';

export type InboxPage =
  operations['NotificationInboxController_list']['responses'][200]['content']['application/json'];
export type InboxItem = InboxPage['data'][number];
export type InboxFilters = {
  category?: 'TRAINER' | 'PROGRAM' | 'WORKOUT' | 'ACCOUNT';
  unread?: 'true';
};
export class InboxRequestError extends Error {
  constructor(
    readonly status?: number,
    readonly accountChanged = false,
  ) {
    super('Notification request failed');
  }
}

export async function currentInboxOwner(signal?: AbortSignal) {
  try {
    const { response, data } = await webApi.GET('/users/me', { signal, cache: 'no-store' });
    if (!response.ok || !data) throw new InboxRequestError(response.status);
    if (data.role === 'ADMIN') throw new InboxRequestError(403);
    return data.id;
  } catch (error) {
    if (error instanceof InboxRequestError || signal?.aborted) throw error;
    throw new InboxRequestError();
  }
}

async function forOwner<T>(
  owner: string,
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  try {
    if ((await currentInboxOwner(signal)) !== owner) throw new InboxRequestError(409, true);
    signal?.throwIfAborted();
    const result = await request();
    if ((await currentInboxOwner(signal)) !== owner) throw new InboxRequestError(409, true);
    signal?.throwIfAborted();
    return result;
  } catch (error) {
    if (error instanceof InboxRequestError || signal?.aborted) throw error;
    throw new InboxRequestError();
  }
}

export function fetchUnread(owner: string, signal: AbortSignal) {
  return forOwner(
    owner,
    async () => {
      const { response, data } = await webApi.GET('/notifications/unread-count', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok || !data) throw new InboxRequestError(response.status);
      return data.count;
    },
    signal,
  );
}

export function fetchInbox(
  owner: string,
  filters: InboxFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  return forOwner(
    owner,
    async () => {
      const { response, data } = await webApi.GET('/notifications', {
        signal,
        cache: 'no-store',
        params: { query: { limit: '20', ...filters, ...(cursor ? { cursor } : {}) } },
      });
      if (!response.ok || !data) throw new InboxRequestError(response.status);
      return data;
    },
    signal,
  );
}

export function markInboxRead(owner: string, id?: string) {
  return forOwner(owner, async () => {
    const result = id
      ? await webApi.PATCH('/notifications/{id}/read', { params: { path: { id } } })
      : await webApi.POST('/notifications/read-all');
    if (!result.response.ok) throw new InboxRequestError(result.response.status);
  });
}
