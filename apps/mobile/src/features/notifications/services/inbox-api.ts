import type { operations } from '@gym/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { z } from 'zod';

import type { createMobileApi } from '@/shared/api/client';
import { accountQueryKeys } from '@/shared/api/query-client';
import { MobileSessionExpiredError, mobileReadError } from '@/shared/api/api-error-policy';
import type { AccountCapabilities } from '@/features/auth/model/account-capabilities';

export type InboxPage =
  operations['NotificationInboxController_list']['responses'][200]['content']['application/json'];
export type InboxItem = InboxPage['data'][number];
export type InboxFilters = {
  category?: 'TRAINER' | 'PROGRAM' | 'WORKOUT' | 'ACCOUNT';
  unread?: 'true';
};

type Connection = {
  getScopedApi: (isCurrent: () => boolean) => ReturnType<typeof createMobileApi> | null;
  signOut: () => Promise<void>;
};

export function captureInboxScope(
  client: QueryClient,
  ownerId: string,
  capabilities: AccountCapabilities,
  connection: Connection,
) {
  const key = accountQueryKeys.me(ownerId);
  const epoch = client.getQueryCache().find({ queryKey: key, exact: true });
  const isCurrent = () =>
    Boolean(
      epoch &&
      client.getQueryData(key) &&
      client.getQueryCache().find({ queryKey: key, exact: true }) === epoch &&
      focusManager.isFocused(),
    );
  return { ownerId, capabilities, epoch, isCurrent, ...connection };
}
export type InboxScope = ReturnType<typeof captureInboxScope>;

function stale(): never {
  const error = new Error('Inbox session changed');
  error.name = 'AbortError';
  throw error;
}

export function assertInboxCurrent(scope: InboxScope, signal?: AbortSignal) {
  if (!scope.isCurrent() || signal?.aborted) stale();
}

async function request<T extends { response: { status: number; ok: boolean } }>(
  scope: InboxScope,
  signal: AbortSignal | undefined,
  send: (api: ReturnType<typeof createMobileApi>) => Promise<T>,
) {
  assertInboxCurrent(scope, signal);
  if (!onlineManager.isOnline()) throw new Error('Inbox unavailable offline');
  const api = scope.getScopedApi(() => scope.isCurrent() && !signal?.aborted);
  if (!api) stale();
  const result = await send(api);
  assertInboxCurrent(scope, signal);
  if (result.response.status === 401) {
    await scope.signOut();
    throw new MobileSessionExpiredError();
  }
  if (!result.response.ok) throw mobileReadError(result.response.status, 'Inbox request failed');
  return result;
}
const headers = (scope: InboxScope) => ({ 'x-inbox-owner': scope.ownerId });

export async function readUnread(scope: InboxScope, signal: AbortSignal) {
  const result = await request(scope, signal, (api) =>
    api.GET('/notifications/unread-count', { headers: headers(scope), signal }),
  );
  const count = z.int().nonnegative().parse(result.data?.count);
  return count;
}

export async function readInbox(
  scope: InboxScope,
  filters: InboxFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  const result = await request(scope, signal, (api) =>
    api.GET('/notifications', {
      headers: headers(scope),
      signal,
      params: { query: { limit: '20', ...filters, ...(cursor ? { cursor } : {}) } },
    }),
  );
  if (!result.data) throw new Error('Missing inbox page');
  return result.data;
}

export async function writeRead(scope: InboxScope, id?: string) {
  if (id !== undefined && !z.uuid().safeParse(id).success)
    throw new Error('Invalid notification ID');
  await request(scope, undefined, async (api) => ({
    response: (
      await (id === undefined
        ? api.POST('/notifications/read-all', { headers: headers(scope) })
        : api.PATCH('/notifications/{id}/read', {
            headers: headers(scope),
            params: { path: { id } },
          }))
    ).response,
  }));
}

const programTypes = [
  'program.assigned',
  'program.assignment.cancelled',
  'program.assignment.terminated',
  'program.assignment.completed',
];
export function canOpenProgram(item: InboxItem) {
  return (
    item.category === 'PROGRAM' &&
    item.type === item.templateKey &&
    programTypes.includes(item.type) &&
    item.target?.kind === 'PROGRAM_ASSIGNMENT' &&
    z.uuid().safeParse(item.target.id).success
  );
}

/** Never use the cached list or an OS payload as resource authorization. */
export async function resolveProgramTarget(
  scope: InboxScope,
  notificationId: string,
  signal: AbortSignal,
) {
  if (
    !z.uuid().safeParse(notificationId).success ||
    !scope.capabilities.athlete ||
    scope.capabilities.admin
  )
    return null;
  const detail = await request(scope, signal, (api) =>
    api.GET('/notifications/{id}', {
      headers: headers(scope),
      signal,
      params: { path: { id: notificationId } },
    }),
  );
  const item = detail.data;
  if (!item || item.id !== notificationId || !canOpenProgram(item) || !item.target) return null;
  const id = item.target.id;
  const resource = await request(scope, signal, (api) =>
    api.GET('/training-programs/assignments/{assignmentId}', {
      signal,
      params: { path: { assignmentId: id } },
    }),
  );
  if (resource.data?.id !== id || resource.data.athleteId !== scope.ownerId) return null;
  assertInboxCurrent(scope, signal);
  return { notificationId, target: { kind: 'programAssignment', id } };
}
