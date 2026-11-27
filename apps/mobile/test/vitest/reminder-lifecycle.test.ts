import { describe, expect, it, vi } from 'vitest';
import { ReminderLifecycle } from '@/features/notifications/model/reminder-lifecycle';
import { combinePrivateDataLifecycles } from '@/features/auth/model/private-data-lifecycle';
import type { InboxScope } from '@/features/notifications/services/inbox-api';
import type {
  NativeReminderPort,
  ReconcileResult,
} from '@/features/notifications/lib/native-reminder-reconciliation';
import type { PreparedReminderPlan } from '@/features/notifications/model/prepare-local-reminders';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const grants = { athlete: true, trainer: false, admin: false };
const ready: ReconcileResult = { kind: 'ready', pending: 0 };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(enabled = true, handlerReady = true) {
  let foreground = true,
    online = true;
  const port = {} as NativeReminderPort;
  const openPort = vi.fn(async () => port as NativeReminderPort | null);
  const cancel = vi.fn(
    async (_port: NativeReminderPort, _includePresented: boolean): Promise<ReconcileResult> =>
      ready,
  );
  const disposed = vi.fn();
  const prepare = vi.fn(
    async (_scope: InboxScope, signal: AbortSignal): Promise<PreparedReminderPlan> => ({
      plan: { kind: 'ready', reminders: [] },
      isCurrent: () => !signal.aborted,
      dispose: disposed,
    }),
  );
  const reconcile = vi.fn(
    async (
      _port: NativeReminderPort,
      _input: { ownerId: string; isCurrent: () => boolean },
    ): Promise<ReconcileResult> => ready,
  );
  const lifecycle = new ReminderLifecycle({
    enabled,
    foreground: () => foreground,
    online: () => online,
    openPort,
    cancel,
    prepare,
    reconcile,
  });
  lifecycle.setForegroundHandlerReady(handlerReady);
  const scope = (ownerId = first) =>
    ({ ownerId, capabilities: grants, isCurrent: () => true }) as InboxScope;
  const connect = async (ownerId = first) => {
    await lifecycle.verified(ownerId, grants);
    lifecycle.update({ scope: scope(ownerId), locale: 'en' });
  };
  return {
    lifecycle,
    openPort,
    cancel,
    prepare,
    reconcile,
    disposed,
    scope,
    connect,
    background: () => {
      foreground = false;
      lifecycle.lock();
    },
    resume: () => {
      foreground = true;
    },
    offline: () => {
      online = false;
      lifecycle.refresh();
    },
    online: () => {
      online = true;
      lifecycle.refresh();
    },
  };
}
describe('reminder lifecycle coordinator', () => {
  it('release-disabled runtime cleans managed state without any prepare or schedule', async () => {
    const f = fixture(false);
    await f.connect();
    await f.lifecycle.end();
    expect(f.cancel).toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled();
    expect(f.reconcile).not.toHaveBeenCalled();
  });
  it('uses pending-only refresh after verified ownership, full cleanup on logout', async () => {
    const f = fixture();
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.cancel.mock.calls.map((call) => call[1])).toContain(false);
    await f.lifecycle.end();
    expect(f.cancel.mock.calls.at(-1)?.[1]).toBe(true);
  });
  it('escalates logout during an in-flight pending-only cleanup', async () => {
    const f = fixture();
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    const entered = deferred(),
      release = deferred();
    f.cancel.mockImplementationOnce(async (_port, full) => {
      expect(full).toBe(false);
      entered.resolve();
      await release.promise;
      return ready;
    });
    f.lifecycle.refresh();
    await entered.promise;
    const ending = f.lifecycle.end();
    release.resolve();
    await ending;
    expect(f.cancel.mock.calls.at(-1)?.[1]).toBe(true);
    expect(f.lifecycle.admitForeground({})).toBe(false);
  });
  it('failed full cleanup is sticky across ordinary refresh', async () => {
    const f = fixture();
    f.cancel.mockResolvedValue({ kind: 'failed' });
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.reconcile).not.toHaveBeenCalled();
    f.cancel.mockResolvedValue(ready);
    f.lifecycle.refresh();
    await vi.waitFor(() => expect(f.reconcile).toHaveBeenCalledOnce());
    expect(f.cancel.mock.calls.at(-1)?.[1]).toBe(true);
    await f.lifecycle.end();
  });
  it('does not prepare until foreground handler installation succeeds', async () => {
    const f = fixture(true, false);
    await f.connect();
    expect(f.prepare).not.toHaveBeenCalled();
    f.lifecycle.setForegroundHandlerReady(true);
    await vi.waitFor(() => expect(f.reconcile).toHaveBeenCalledOnce());
    await f.lifecycle.end();
  });

  it('only admits verified native inventory and synchronously revokes on refresh/logout', async () => {
    const f = fixture();
    const entry = {
      identifier: 'ovranto.workout-reminder.v1.' + 'a'.repeat(64),
      dueAt: Date.parse('2026-11-27T12:00:30Z'),
      title: 'OVRANTO',
      body: 'You have an upcoming workout.',
      platform: 'android' as const,
    };
    const notice = {
      request: {
        identifier: entry.identifier,
        content: { title: entry.title, body: entry.body, data: {} },
        trigger: {
          type: 'date',
          value: entry.dueAt,
          channelId: 'workout-reminders',
          delivery: 'bestEffort',
          repeats: false,
        },
      },
    };
    f.reconcile.mockResolvedValue({ kind: 'ready', pending: 1, verified: [entry] });
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.lifecycle.admitForeground(notice, entry.dueAt)).toBe(true);
    expect(f.lifecycle.admitForeground(notice, entry.dueAt)).toBe(false);
    f.lifecycle.refresh();
    expect(f.lifecycle.admitForeground(notice, entry.dueAt)).toBe(false);
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledTimes(2));
    const ending = f.lifecycle.end();
    expect(f.lifecycle.admitForeground(notice, entry.dueAt)).toBe(false);
    await ending;
  });

  it('verifies cleanup before scheduling and disposes each evidence fence', async () => {
    const f = fixture();
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.reconcile).toHaveBeenCalledOnce();
    expect(f.reconcile.mock.calls[0]![1].ownerId).toBe(first);
    expect(f.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      f.reconcile.mock.invocationCallOrder[0]!,
    );
    await f.lifecycle.end();
    expect(f.reconcile.mock.calls[0]![1].isCurrent()).toBe(false);
  });
  it('fails closed if cleanup failed, retries cleanup only on next event', async () => {
    const f = fixture();
    f.cancel.mockResolvedValue({ kind: 'failed' });
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.reconcile).not.toHaveBeenCalled();
    f.cancel.mockResolvedValue(ready);
    f.lifecycle.refresh();
    await vi.waitFor(() => expect(f.reconcile).toHaveBeenCalledOnce());
    await f.lifecycle.end();
  });
  it('normal background keeps settled reminders, but foreground re-verification cleans and reacquires', async () => {
    const f = fixture();
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    const calls = f.cancel.mock.calls.length;
    f.background();
    f.lifecycle.update(null);
    f.lifecycle.refresh();
    expect(f.cancel).toHaveBeenCalledTimes(calls);
    expect(f.prepare).toHaveBeenCalledOnce();
    f.resume();
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledTimes(2));
    expect(f.cancel.mock.calls.length).toBeGreaterThan(calls);
    expect(f.reconcile).toHaveBeenCalledTimes(2);
    await f.lifecycle.end();
  });
  it('logout does not wait for a pending GET that itself awaits signout cleanup', async () => {
    const f = fixture();
    const entered = deferred(),
      release = deferred();
    f.prepare.mockImplementationOnce(async (_scope, signal) => {
      entered.resolve();
      await release.promise;
      await f.lifecycle.end(); // current 401 awaits auth cleanup
      expect(signal.aborted).toBe(true);
      return {
        plan: { kind: 'blocked', reason: 'scope' },
        isCurrent: () => false,
        dispose: f.disposed,
      };
    });
    await f.connect();
    await entered.promise;
    await f.lifecycle.end();
    release.resolve();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.reconcile).not.toHaveBeenCalled();
  });
  it('account switch fences late GETs and only schedules for newly verified owner', async () => {
    const f = fixture();
    const entered = deferred(),
      release = deferred();
    f.prepare.mockImplementationOnce(async (_scope, signal) => {
      entered.resolve();
      await release.promise;
      expect(signal.aborted).toBe(true);
      return {
        plan: { kind: 'ready', reminders: [] },
        isCurrent: () => false,
        dispose: f.disposed,
      };
    });
    await f.connect();
    await entered.promise;
    await f.connect(second);
    release.resolve();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledTimes(2));
    expect(f.reconcile).toHaveBeenCalledOnce();
    expect(f.reconcile.mock.calls[0]![1].ownerId).toBe(second);
    await f.lifecycle.end();
  });
  it('logout waits for an in-flight native write and verifies cleanup afterwards', async () => {
    const f = fixture();
    const entered = deferred(),
      release = deferred();
    f.reconcile.mockImplementationOnce(async (_port, input) => {
      entered.resolve();
      await release.promise;
      expect(input.isCurrent()).toBe(false);
      return { kind: 'failed' };
    });
    await f.connect();
    await entered.promise;
    const ended = vi.fn();
    const logout = f.lifecycle.end().then(ended);
    expect(ended).not.toHaveBeenCalled();
    release.resolve();
    await logout;
    expect(ended).toHaveBeenCalledOnce();
    expect(f.cancel.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      f.reconcile.mock.invocationCallOrder[0]!,
    );
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
  });
  it('offline and permission/consent block prevent native writes; reconnect reacquires', async () => {
    const f = fixture();
    f.prepare.mockResolvedValueOnce({
      plan: { kind: 'blocked', reason: 'permission' },
      isCurrent: () => false,
      dispose: f.disposed,
    });
    await f.connect();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledOnce());
    expect(f.reconcile).not.toHaveBeenCalled();
    f.offline();
    expect(f.prepare).toHaveBeenCalledOnce();
    f.online();
    await vi.waitFor(() => expect(f.reconcile).toHaveBeenCalledOnce());
    await f.lifecycle.verified(first, { ...grants, athlete: false, trainer: true });
    f.lifecycle.update({ scope: f.scope(), locale: 'en' });
    await f.lifecycle.end();
    expect(f.reconcile).toHaveBeenCalledOnce();
  });
  it('coalesces refresh bursts and immediately fences older preparation', async () => {
    const f = fixture();
    const entered = deferred(),
      release = deferred();
    f.prepare.mockImplementationOnce(async (_scope, signal) => {
      entered.resolve();
      await release.promise;
      expect(signal.aborted).toBe(true);
      return {
        plan: { kind: 'ready', reminders: [] },
        isCurrent: () => false,
        dispose: f.disposed,
      };
    });
    await f.connect();
    await entered.promise;
    for (let n = 0; n < 20; n++) f.lifecycle.refresh();
    release.resolve();
    await vi.waitFor(() => expect(f.disposed).toHaveBeenCalledTimes(2));
    expect(f.prepare).toHaveBeenCalledTimes(2);
    expect(f.reconcile).toHaveBeenCalledOnce();
    await f.lifecycle.end();
  });
});

describe('private data composition', () => {
  it('invokes every participant synchronously and waits for cleanup even when another fails', async () => {
    const slow = deferred();
    const broken = {
      lock: vi.fn(() => {
        throw new Error('lock failed');
      }),
      verified: vi.fn(() => {
        throw new Error('verified failed');
      }),
      end: vi.fn(() => {
        throw new Error('end failed');
      }),
    };
    const other = {
      lock: vi.fn(),
      verified: vi.fn(async () => undefined),
      end: vi.fn(() => slow.promise),
    };
    const combined = combinePrivateDataLifecycles(broken, other);
    combined.lock();
    expect(other.lock).toHaveBeenCalledOnce();
    await combined.verified(first, grants);
    expect(other.verified).toHaveBeenCalledExactlyOnceWith(first, grants);
    const done = vi.fn();
    const ending = combined.end().then(done);
    expect(other.end).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
    slow.resolve();
    await ending;
    expect(done).toHaveBeenCalledOnce();
  });
});
