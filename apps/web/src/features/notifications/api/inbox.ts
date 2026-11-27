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
  constructor(readonly status?: number) {
    super('Notification request failed');
  }
}

async function requestInbox<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    signal?.throwIfAborted();
    return await request();
  } catch (error) {
    if (error instanceof InboxRequestError || signal?.aborted) throw error;
    throw new InboxRequestError();
  }
}
const ownerHeader = (owner: string) => ({ 'x-inbox-owner': owner });

export function fetchUnread(owner: string, signal: AbortSignal) {
  return requestInbox(async () => {
    const { response, data } = await webApi.GET('/notifications/unread-count', {
      signal,
      cache: 'no-store',
      headers: ownerHeader(owner),
    });
    if (!response.ok || !data) throw new InboxRequestError(response.status);
    return data.count;
  }, signal);
}

export function fetchInbox(
  owner: string,
  filters: InboxFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  return requestInbox(async () => {
    const { response, data } = await webApi.GET('/notifications', {
      signal,
      cache: 'no-store',
      headers: ownerHeader(owner),
      params: { query: { limit: '20', ...filters, ...(cursor ? { cursor } : {}) } },
    });
    if (!response.ok || !data) throw new InboxRequestError(response.status);
    return data;
  }, signal);
}

export function markInboxRead(owner: string, id?: string) {
  return requestInbox(async () => {
    const result = id
      ? await webApi.PATCH('/notifications/{id}/read', {
          params: { path: { id } },
          headers: ownerHeader(owner),
        })
      : await webApi.POST('/notifications/read-all', { headers: ownerHeader(owner) });
    if (!result.response.ok) throw new InboxRequestError(result.response.status);
  });
}
