import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountQueryKeys, createMobileQueryClient } from '@/shared/api/query-client';
import type { createMobileApi } from '@/shared/api/client';
import {
  captureInboxScope,
  readInbox,
  readUnread,
  resolveProgramTarget,
  writeRead,
} from '@/features/notifications/services/inbox-api';
import { createNotificationOpenCoordinator } from '@/features/notifications/lib/notification-open';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const notificationId = '33333333-3333-4333-8333-333333333333';
const assignmentId = '44444444-4444-4444-8444-444444444444';
const grants = { athlete: true, trainer: false, admin: false };
const item = {
  id: notificationId,
  type: 'program.assigned',
  templateKey: 'program.assigned',
  category: 'PROGRAM',
  target: { kind: 'PROGRAM_ASSIGNMENT', id: assignmentId },
};
const ok = (data: unknown) => ({ response: { status: 200, ok: true }, data });
const fail = (status: number) => ({ response: { status, ok: false } });
const clients: QueryClient[] = [];

function harness() {
  const client = createMobileQueryClient();
  clients.push(client);
  client.setQueryData(accountQueryKeys.me(owner), { id: owner });
  const get = vi.fn(),
    post = vi.fn(),
    patch = vi.fn(),
    signOut = vi.fn(async () => undefined);
  const getScopedApi = vi.fn((current: () => boolean) =>
    current()
      ? ({ GET: get, POST: post, PATCH: patch } as unknown as ReturnType<typeof createMobileApi>)
      : null,
  );
  const scope = captureInboxScope(client, owner, grants, { getScopedApi, signOut });
  const signal = new AbortController().signal;
  const navigate = vi.fn();
  const coordinator = createNotificationOpenCoordinator({
    getVerifiedScope: () =>
      scope.epoch && scope.isCurrent()
        ? { ownerId: owner, epoch: scope.epoch, capabilities: grants }
        : null,
    resolveAuthorizedTarget: (id, _, sig) => resolveProgramTarget(scope, id, sig),
    navigate,
  });
  return { client, get, post, patch, signOut, getScopedApi, scope, signal, navigate, coordinator };
}

beforeEach(() => {
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('Mobile Inbox authenticated API', () => {
  it('uses the verified owner fence on every inbox operation and cursor', async () => {
    const h = harness();
    h.get
      .mockResolvedValueOnce(ok({ count: 3 }))
      .mockResolvedValueOnce(ok({ data: [item], nextCursor: 'next' }));
    h.patch.mockResolvedValueOnce(ok(item));
    h.post.mockResolvedValueOnce({ response: { status: 204, ok: true } });
    expect(await readUnread(h.scope, h.signal)).toBe(3);
    expect(
      await readInbox(h.scope, { category: 'PROGRAM', unread: 'true' }, 'cursor', h.signal),
    ).toEqual({ data: [item], nextCursor: 'next' });
    await writeRead(h.scope, notificationId);
    await writeRead(h.scope);
    const headers = { 'x-inbox-owner': owner };
    expect(h.get).toHaveBeenNthCalledWith(1, '/notifications/unread-count', {
      headers,
      signal: h.signal,
    });
    expect(h.get).toHaveBeenNthCalledWith(2, '/notifications', {
      headers,
      signal: h.signal,
      params: { query: { category: 'PROGRAM', unread: 'true', limit: '20', cursor: 'cursor' } },
    });
    expect(h.patch).toHaveBeenCalledExactlyOnceWith('/notifications/{id}/read', {
      headers,
      params: { path: { id: notificationId } },
    });
    expect(h.post).toHaveBeenCalledExactlyOnceWith('/notifications/read-all', { headers });
    expect(h.client.getQueryDefaults(accountQueryKeys.me(owner)).gcTime).toBe(Infinity);
  });
  it('blocks old scopes even when same owner signs in again, and never queues offline writes', async () => {
    const h = harness();
    onlineManager.setOnline(false);
    await expect(writeRead(h.scope)).rejects.toThrow('offline');
    onlineManager.setOnline(true);
    h.client.clear();
    h.client.setQueryData(accountQueryKeys.me(owner), { id: owner });
    await expect(writeRead(h.scope)).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.post).not.toHaveBeenCalled();
    expect(h.getScopedApi).not.toHaveBeenCalled();
  });
  it('discards late 401 and write completion after switching accounts', async () => {
    const h = harness();
    let finish!: (value: unknown) => void;
    h.patch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = writeRead(h.scope, notificationId);
    h.client.clear();
    h.client.setQueryData(accountQueryKeys.me(other), { id: other });
    finish(fail(401));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.signOut).not.toHaveBeenCalled();
  });
  it('401 expires only current session; 403/409 never log out or retry', async () => {
    const h = harness();
    h.get
      .mockResolvedValueOnce(fail(403))
      .mockResolvedValueOnce(fail(409))
      .mockResolvedValueOnce(fail(401));
    await expect(readUnread(h.scope, h.signal)).rejects.toMatchObject({
      name: 'MobileAccessDeniedError',
    });
    await expect(readUnread(h.scope, h.signal)).rejects.toMatchObject({ status: 409 });
    expect(h.signOut).not.toHaveBeenCalled();
    await expect(readUnread(h.scope, h.signal)).rejects.toMatchObject({
      name: 'MobileSessionExpiredError',
    });
    expect(h.signOut).toHaveBeenCalledOnce();
  });
  it('checks fresh detail then assignment ownership before fixed route navigation', async () => {
    const h = harness();
    h.get
      .mockResolvedValueOnce(ok(item))
      .mockResolvedValueOnce(ok({ id: assignmentId, athleteId: owner }));
    expect(await h.coordinator.open({ notificationId })).toBe('opened');
    expect(h.get.mock.calls.map(([path]) => path)).toEqual([
      '/notifications/{id}',
      '/training-programs/assignments/{assignmentId}',
    ]);
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith({
      pathname: '/programs/[id]',
      params: { id: assignmentId },
    });
  });
  it('rejects arbitrary envelope before network; denies stale detail, revoked resource, foreign target and wrong owner', async () => {
    const h = harness();
    expect(await h.coordinator.open({ notificationId, url: '/admin' })).toBe('invalid');
    expect(h.get).not.toHaveBeenCalled();
    h.get.mockResolvedValueOnce(fail(404));
    expect(await h.coordinator.open({ notificationId })).not.toBe('opened');
    h.get.mockResolvedValueOnce(ok({ ...item, target: { kind: 'URL', id: 'https://evil.test' } }));
    expect(await h.coordinator.open({ notificationId })).toBe('denied');
    h.get.mockResolvedValueOnce(ok(item)).mockResolvedValueOnce(fail(403));
    expect(await h.coordinator.open({ notificationId })).not.toBe('opened');
    h.get
      .mockResolvedValueOnce(ok(item))
      .mockResolvedValueOnce(ok({ id: assignmentId, athleteId: other }));
    expect(await h.coordinator.open({ notificationId })).toBe('denied');
    expect(h.navigate).not.toHaveBeenCalled();
  });
  it('never navigates after background or same-account re-verification during resource read', async () => {
    const h = harness();
    let finish!: (value: unknown) => void;
    h.get.mockResolvedValueOnce(ok(item)).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = h.coordinator.open({ notificationId });
    await vi.waitFor(() => expect(h.get).toHaveBeenCalledTimes(2));
    focusManager.setFocused(false);
    h.client.clear();
    h.client.setQueryData(accountQueryKeys.me(owner), { id: owner });
    focusManager.setFocused(true);
    finish(ok({ id: assignmentId, athleteId: owner }));
    expect(await pending).toBe('stale');
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
