import { createBrowserSessionClient, type operations } from '@gym/api-client';

const api = createBrowserSessionClient({
  baseUrl: '/backend',
  redirect: 'error',
  cache: 'no-store',
});
export type InboxPage =
  operations['NotificationInboxController_list']['responses'][200]['content']['application/json'];
export type InboxItem = InboxPage['data'][number];
export type InboxFilters = {
  category?: 'ACCOUNT' | 'TRAINER' | 'PROGRAM' | 'WORKOUT';
  unread?: 'true';
};
export class InboxError extends Error {
  constructor(readonly status?: number) {
    super('Inbox request failed');
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = (owner: string) => ({ 'x-inbox-owner': owner, 'x-inbox-audience': 'trainer' });
function check(response: Response) {
  if (!response.ok) throw new InboxError(response.status);
}
export async function readOwner(signal: AbortSignal) {
  const { response, data } = await api.GET('/users/me', { signal });
  check(response);
  if (!data || data.role === 'ADMIN' || !uuid.test(data.id)) throw new InboxError(403);
  return data.id;
}
export async function unreadCount(owner: string, signal: AbortSignal) {
  const { response, data } = await api.GET('/notifications/unread-count', {
    headers: headers(owner),
    signal,
  });
  check(response);
  if (!data || !Number.isSafeInteger(data.count) || data.count < 0) throw new InboxError();
  return data.count;
}
export async function readInbox(
  owner: string,
  filters: InboxFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  const { response, data } = await api.GET('/notifications', {
    headers: headers(owner),
    signal,
    params: { query: { limit: '20', ...filters, ...(cursor ? { cursor } : {}) } },
  });
  check(response);
  if (!data || !Array.isArray(data.data)) throw new InboxError();
  return data;
}
export async function markRead(owner: string, id?: string) {
  if (id !== undefined && !uuid.test(id)) throw new InboxError();
  const { response } = id
    ? await api.PATCH('/notifications/{id}/read', {
        headers: headers(owner),
        params: { path: { id } },
      })
    : await api.POST('/notifications/read-all', { headers: headers(owner) });
  check(response);
}
export function canOpenClient(item: InboxItem) {
  return (
    item.type === 'trainer.invitation.accepted' &&
    item.templateKey === item.type &&
    item.category === 'TRAINER' &&
    item.target?.kind === 'TRAINER_RELATIONSHIP' &&
    uuid.test(item.target.id)
  );
}
export async function resolveClient(owner: string, notificationId: string, signal: AbortSignal) {
  if (!uuid.test(notificationId)) throw new InboxError();
  const { response, data } = await api.GET('/notifications/{id}', {
    headers: headers(owner),
    signal,
    params: { path: { id: notificationId } },
  });
  check(response);
  if (!data || data.id !== notificationId || !canOpenClient(data) || !data.target)
    throw new InboxError(404);
  // The existing SSR client page independently checks live trainer ownership
  // and ACTIVE status through the scoped dashboard API.
  const id = data.target.id;
  const progress = await api.GET('/trainer-dashboard/clients/{relationId}/progress', {
    signal,
    params: { path: { relationId: id } },
  });
  if (progress.response.status === 403 || progress.response.status === 404)
    throw new InboxError(404);
  check(progress.response);
  signal.throwIfAborted();
  return '/workspace/clients/' + id;
}
