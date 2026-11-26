import { describe, expect, it, vi } from 'vitest';

import {
  createNotificationOpenCoordinator,
  type VerifiedNotificationScope,
} from '@/features/notifications/lib/notification-open';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const notificationId = '33333333-3333-4333-8333-333333333333';
const otherNotification = '44444444-4444-4444-8444-444444444444';
const resourceId = '55555555-5555-4555-8555-555555555555';
const envelope = { notificationId };
const grants = { athlete: true, trainer: false, admin: false };
const authorized = { notificationId, target: { kind: 'workout', id: resourceId } };
function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  let scope: VerifiedNotificationScope | null = { ownerId, epoch: {}, capabilities: grants };
  const navigate = vi.fn();
  const resolveAuthorizedTarget = vi.fn(
    async (..._args: unknown[]): Promise<unknown> => authorized,
  );
  const coordinator = createNotificationOpenCoordinator({
    getVerifiedScope: () => scope,
    resolveAuthorizedTarget,
    navigate,
  });
  return {
    ...coordinator,
    navigate,
    resolveAuthorizedTarget,
    setScope: (next: VerifiedNotificationScope | null) => {
      scope = next;
    },
    getScope: () => scope,
  };
}

describe('notification open intent (local policy, no live API)', () => {
  it('rejects malformed, non-UUID and over-specified transport envelopes before resolution', async () => {
    const h = harness();
    for (const value of [
      null,
      'https://example.invalid',
      { notificationId: 'bad' },
      { ...envelope, url: '/admin' },
      { ...envelope, workoutId: resourceId },
    ]) {
      expect(await h.open(value)).toBe('invalid');
    }
    expect(h.resolveAuthorizedTarget).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('denies unverified, trainer-only, admin and malformed capability scopes', async () => {
    const h = harness();
    for (const scope of [
      null,
      { ownerId: 'bad', epoch: {}, capabilities: grants },
      { ownerId, epoch: {}, capabilities: { athlete: false, trainer: true, admin: false } },
      { ownerId, epoch: {}, capabilities: { ...grants, admin: true } },
      {
        ownerId,
        epoch: {},
        capabilities: { ...grants, athlete: 'true' },
      } as unknown as VerifiedNotificationScope,
    ]) {
      h.setScope(scope);
      expect(await h.open(envelope)).toBe('denied');
    }
    expect(h.resolveAuthorizedTarget).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('passes only the opaque ID to a current verified resolver and maps a workout to a fixed route', async () => {
    const h = harness();
    expect(await h.open(envelope)).toBe('opened');
    expect(h.resolveAuthorizedTarget).toHaveBeenCalledExactlyOnceWith(
      notificationId,
      h.getScope(),
      expect.any(AbortSignal),
    );
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith({
      pathname: '/workouts/[id]',
      params: { id: resourceId },
    });
  });

  it('maps only an authorized program assignment to its existing internal route', async () => {
    const h = harness();
    h.resolveAuthorizedTarget.mockResolvedValueOnce({
      notificationId,
      target: { kind: 'programAssignment', id: resourceId },
    });
    expect(await h.open(envelope)).toBe('opened');
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith({
      pathname: '/programs/[id]',
      params: { id: resourceId },
    });
  });

  it('rejects mismatched notifications, unknown targets, arbitrary links and extra data', async () => {
    const h = harness();
    for (const value of [
      null,
      { ...authorized, notificationId: otherNotification },
      { ...authorized, target: { kind: 'admin', id: resourceId } },
      { ...authorized, target: { kind: 'workout', id: '../../admin' } },
      {
        ...authorized,
        target: { kind: 'workout', id: resourceId, url: 'https://example.invalid' },
      },
      { ...authorized, recipientId: otherOwner },
      { ...authorized, target: { kind: 'programVersion', id: resourceId } },
    ]) {
      h.resolveAuthorizedTarget.mockResolvedValueOnce(value);
      expect(await h.open(envelope)).toBe('denied');
    }
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('rejects late resolution after logout or switching accounts, even when resolver ignores abort', async () => {
    const h = harness();
    const first = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(first.promise);
    const pending = h.open(envelope);
    h.setScope({ ownerId: otherOwner, epoch: {}, capabilities: grants });
    first.resolve(authorized);
    expect(await pending).toBe('stale');
    const next = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(next.promise);
    const logout = h.open(envelope);
    h.setScope(null);
    next.resolve(authorized);
    expect(await logout).toBe('stale');
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('rejects stale same-account epoch or revoked athlete capability', async () => {
    const h = harness();
    const first = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(first.promise);
    const pending = h.open(envelope);
    h.setScope({ ownerId, epoch: {}, capabilities: grants });
    first.resolve(authorized);
    expect(await pending).toBe('stale');
    const next = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(next.promise);
    const revoked = h.open(envelope);
    h.setScope({ ...h.getScope()!, capabilities: { athlete: false, trainer: true, admin: false } });
    next.resolve(authorized);
    expect(await revoked).toBe('stale');
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('cancels a superseded intent and never replays it when its response arrives', async () => {
    const h = harness();
    const first = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(first.promise);
    const pending = h.open(envelope);
    const signal = h.resolveAuthorizedTarget.mock.calls[0]?.[2] as AbortSignal;
    h.resolveAuthorizedTarget.mockResolvedValueOnce({
      ...authorized,
      notificationId: otherNotification,
    });
    expect(await h.open({ notificationId: otherNotification })).toBe('opened');
    expect(signal.aborted).toBe(true);
    first.resolve(authorized);
    expect(await pending).toBe('stale');
    expect(h.navigate).toHaveBeenCalledOnce();
  });

  it('cancels explicitly on lifecycle lock without retaining or replaying an intent', async () => {
    const h = harness();
    const first = deferred();
    h.resolveAuthorizedTarget.mockReturnValueOnce(first.promise);
    const pending = h.open(envelope);
    const signal = h.resolveAuthorizedTarget.mock.calls[0]?.[2] as AbortSignal;
    h.cancel();
    expect(signal.aborted).toBe(true);
    first.resolve(authorized);
    expect(await pending).toBe('stale');
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.resolveAuthorizedTarget).toHaveBeenCalledOnce();
  });

  it('returns generic unavailable on transport failure with no implicit retry or navigation', async () => {
    const h = harness();
    h.resolveAuthorizedTarget.mockRejectedValueOnce(new Error('private server detail'));
    expect(await h.open(envelope)).toBe('unavailable');
    expect(h.resolveAuthorizedTarget).toHaveBeenCalledOnce();
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
