import { createBrowserSessionClient, type operations } from '@gym/api-client';

const api = createBrowserSessionClient({
  baseUrl: '/backend',
  redirect: 'error',
  cache: 'no-store',
});
export type InboxPage =
  operations['AdminNotificationInboxController_list']['responses'][200]['content']['application/json'];
export type InboxItem = InboxPage['data'][number];
const event = 'admin.trainer.review.required';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  iso.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);
const headers = (owner: string) => ({ 'x-inbox-owner': owner });
export class InboxError extends Error {
  constructor(readonly status?: number) {
    super('Admin Inbox request failed');
  }
}
function check(response: Response, expected: number) {
  if (response.status !== expected) throw new InboxError(response.status);
}
export function parseItem(value: unknown): InboxItem {
  if (
    !record(value) ||
    !exact(value, ['id', 'type', 'category', 'templateKey', 'createdAt', 'readAt']) ||
    typeof value.id !== 'string' ||
    !uuid.test(value.id) ||
    value.type !== event ||
    value.templateKey !== event ||
    value.category !== 'ACCOUNT' ||
    !date(value.createdAt) ||
    (value.readAt !== null && !date(value.readAt))
  )
    throw new InboxError();
  return {
    id: value.id,
    type: event,
    templateKey: event,
    category: 'ACCOUNT',
    createdAt: value.createdAt,
    readAt: value.readAt,
  };
}
export function parsePage(value: unknown): InboxPage {
  if (
    !record(value) ||
    !exact(value, ['data', 'nextCursor']) ||
    !Array.isArray(value.data) ||
    value.data.length > 20 ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === 'string' &&
        value.nextCursor.length <= 100 &&
        value.nextCursor.length > 0)
    )
  )
    throw new InboxError();
  const data = value.data.map(parseItem);
  if (new Set(data.map((item) => item.id)).size !== data.length) throw new InboxError();
  return { data, nextCursor: value.nextCursor };
}
export async function unreadCount(owner: string, signal: AbortSignal) {
  const { response, data } = await api.GET('/admin/notifications/unread-count', {
    headers: headers(owner),
    signal,
  });
  check(response, 200);
  if (
    !record(data) ||
    !exact(data, ['count']) ||
    typeof data.count !== 'number' ||
    !Number.isSafeInteger(data.count) ||
    data.count < 0
  )
    throw new InboxError();
  signal.throwIfAborted();
  return data.count;
}
export async function readInbox(
  owner: string,
  cursor: string | null,
  unread: boolean,
  signal: AbortSignal,
) {
  const { response, data } = await api.GET('/admin/notifications', {
    headers: headers(owner),
    signal,
    params: {
      query: {
        limit: '20',
        ...(cursor ? { cursor } : {}),
        ...(unread ? { unread: 'true' as const } : {}),
      },
    },
  });
  check(response, 200);
  signal.throwIfAborted();
  return parsePage(data);
}
export async function markRead(owner: string, id?: string) {
  if (id !== undefined && !uuid.test(id)) throw new InboxError();
  if (id) {
    const { response, data } = await api.PATCH('/admin/notifications/{id}/read', {
      headers: headers(owner),
      params: { path: { id } },
    });
    check(response, 200);
    const item = parseItem(data);
    if (item.id !== id || item.readAt === null) throw new InboxError();
  } else {
    const { response } = await api.POST('/admin/notifications/read-all', {
      headers: headers(owner),
    });
    check(response, 204);
  }
}
