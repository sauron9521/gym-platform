import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountQueryKeys } from '@/shared/api/query-client';
import type { createMobileApi } from '@/shared/api/client';
import { captureInboxScope } from '@/features/notifications/services/inbox-api';
import {
  readReminderWorkouts,
  REMINDER_HORIZON_MS,
} from '@/features/notifications/services/reminder-snapshot';
import {
  prepareLocalReminders,
  type PreparedReminderPlan,
} from '@/features/notifications/model/prepare-local-reminders';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const anchor = Date.parse('2026-11-27T12:00:00Z');
const id = (n: number) => '33333333-3333-4333-8333-' + String(n).padStart(12, '0');
const item = (n = 1, ms = 2 * 3600000) => ({
  id: id(n),
  athleteId: owner,
  status: 'PLANNED',
  scheduledAt: new Date(anchor + ms).toISOString(),
  title: 'private workout',
});
const page = (data: unknown[], total = data.length) => ({
  response: { status: 200 },
  data: { data, meta: { total, totalPages: Math.ceil(total / 100), skip: 0, take: 100 } },
});
const settings = {
  quietHoursEnabled: false,
  quietStartMinute: 1320,
  quietEndMinute: 480,
  reminderLeadMinutes: 60,
  timezone: 'UTC',
  preferences: [
    {
      category: 'WORKOUT',
      channel: 'LOCAL_REMINDER',
      enabled: true,
      consentedAt: '2026-11-26T12:00:00Z',
    },
    { category: 'TRAINER', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'PROGRAM', channel: 'MOBILE_PUSH', enabled: false, consentedAt: null },
    { category: 'ACCOUNT', channel: 'EMAIL', enabled: false, consentedAt: null },
  ],
};
const cleanups: (() => void)[] = [];
beforeEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(accountQueryKeys.me(owner), { id: owner });
  const controller = new AbortController();
  const get = vi.fn(async (path: string, _options: unknown) =>
    path === '/workouts' ? page([item()]) : { response: { status: 200 }, data: settings },
  );
  const signOut = vi.fn(async () => undefined);
  const scope = captureInboxScope(
    client,
    owner,
    { athlete: true, admin: false, trainer: false },
    {
      getScopedApi: () => ({ GET: get }) as unknown as ReturnType<typeof createMobileApi>,
      signOut,
    },
  );
  const readPermission = vi.fn(async () => 'granted' as const);
  let time = anchor;
  const read = () => readReminderWorkouts(scope, new Date(anchor), controller.signal);
  const prepare = async (overrides: Partial<Parameters<typeof prepareLocalReminders>[0]> = {}) => {
    const result = await prepareLocalReminders({
      client,
      scope,
      signal: controller.signal,
      readPermission,
      now: () => time,
      ...overrides,
    });
    cleanups.push(result.dispose);
    return result;
  };
  cleanups.push(() => {
    controller.abort();
    client.clear();
  });
  return {
    client,
    scope,
    controller,
    get,
    signOut,
    readPermission,
    read,
    prepare,
    setTime: (value: number) => {
      time = value;
    },
  };
}
describe('bounded reminder workout snapshot', () => {
  it('requests one server-sorted summary page with exact inclusive elapsed bounds and strips private fields', async () => {
    const h = harness();
    expect(await h.read()).toEqual([
      { id: id(1), athleteId: owner, status: 'PLANNED', scheduledAt: item().scheduledAt },
    ]);
    expect(h.get).toHaveBeenCalledExactlyOnceWith('/workouts', {
      signal: h.controller.signal,
      params: {
        query: {
          page: 1,
          limit: 100,
          view: 'summary',
          status: 'PLANNED',
          sort: 'scheduledAtAsc',
          scheduledFrom: new Date(anchor).toISOString(),
          scheduledTo: new Date(anchor + REMINDER_HORIZON_MS).toISOString(),
        },
      },
    });
  });
  it('accepts empty complete snapshot and inclusive horizon boundaries', async () => {
    const h = harness();
    h.get.mockResolvedValueOnce(page([]));
    expect(await h.read()).toEqual([]);
    h.get.mockResolvedValueOnce(page([item(1, 0), item(2, REMINDER_HORIZON_MS)]));
    expect(await h.read()).toHaveLength(2);
  });
  it('rejects partial, overflow, malformed, foreign, duplicate, nonplanned and out-of-order responses', async () => {
    const h = harness();
    for (const response of [
      page([item()], 101),
      page([item()], 2),
      page([item(), item()]),
      page([{ ...item(), athleteId: other }]),
      page([{ ...item(), status: 'COMPLETED' }]),
      page([{ ...item(), scheduledAt: '2026-02-30T12:00:00Z' }]),
      page([item(1, -1)]),
      page([item(1, REMINDER_HORIZON_MS + 1)]),
      page([item(1, 120000), item(2, 60000)]),
    ]) {
      h.get.mockResolvedValueOnce(response);
      await expect(h.read()).rejects.toThrow(/snapshot/i);
    }
    expect(h.get).toHaveBeenCalledTimes(9);
  });
  it('signs out only a current 401; rejects stale 401 without signout', async () => {
    const h = harness();
    h.get.mockResolvedValueOnce({ response: { status: 401 } } as never);
    await expect(h.read()).rejects.toMatchObject({ name: 'MobileSessionExpiredError' });
    expect(h.signOut).toHaveBeenCalledOnce();
    h.get.mockImplementationOnce(async () => {
      h.controller.abort();
      return { response: { status: 401 } } as never;
    });
    await expect(h.read()).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.signOut).toHaveBeenCalledOnce();
  });
});
describe('fresh prepared reminder evidence', () => {
  it('uses actual GETs rather than cached settings or workout list, never writes query cache', async () => {
    const h = harness();
    h.client.setQueryData(accountQueryKeys.notificationSettings(owner), { stale: true });
    h.client.setQueryData(accountQueryKeys.workouts(owner), [{ stale: true }]);
    const result = await h.prepare();
    expect(result.plan).toEqual({
      kind: 'ready',
      reminders: [{ workoutId: id(1), dueAt: '2026-11-27T13:00:00.000Z' }],
    });
    expect(h.get.mock.calls.map(([path]) => path)).toEqual([
      '/users/me/notification-settings',
      '/workouts',
    ]);
    expect(h.get.mock.calls[0]?.[1]).toMatchObject({ headers: { 'x-notification-owner': owner } });
    expect(h.client.getQueryData(accountQueryKeys.notificationSettings(owner))).toEqual({
      stale: true,
    });
    expect(result.isCurrent()).toBe(true);
    result.dispose();
    expect(result.isCurrent()).toBe(false);
  });
  it('skips network when no permission, offline, or pending mutation; skips workouts when consent off', async () => {
    const h = harness();
    expect((await h.prepare({ readPermission: async () => 'denied' })).plan).toEqual({
      kind: 'blocked',
      reason: 'permission',
    });
    expect(h.get).not.toHaveBeenCalled();
    onlineManager.setOnline(false);
    expect((await h.prepare()).plan.kind).toBe('blocked');
    expect(h.get).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    h.get.mockResolvedValueOnce({
      response: { status: 200 },
      data: {
        ...settings,
        preferences: [
          { category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: false, consentedAt: null },
          ...settings.preferences.slice(1),
        ],
      },
    });
    expect((await h.prepare()).plan).toEqual({ kind: 'blocked', reason: 'consent' });
    expect(h.get).toHaveBeenCalledTimes(1);
    const mutation = h.client
      .getMutationCache()
      .build(h.client, { mutationFn: () => new Promise(() => {}) });
    void mutation.execute(undefined);
    expect((await h.prepare()).plan.kind).toBe('blocked');
    expect(h.get).toHaveBeenCalledTimes(1);
  });
  it('reacquires evidence after workout invalidation and settings cache writes, not stale replay', async () => {
    const h = harness();
    h.client.setQueryData(accountQueryKeys.workouts(owner), []);
    const first = await h.prepare();
    await h.client.invalidateQueries({ queryKey: accountQueryKeys.workouts(owner) });
    expect(first.isCurrent()).toBe(false);
    first.dispose();
    const second = await h.prepare();
    h.client.setQueryData(accountQueryKeys.notificationSettings(owner), settings);
    expect(second.isCurrent()).toBe(false);
    second.dispose();
    h.get.mockImplementation(async (path) =>
      path === '/workouts' ? page([]) : { response: { status: 200 }, data: settings },
    );
    const third = await h.prepare();
    expect(third.plan).toEqual({ kind: 'ready', reminders: [] });
    expect(h.get).toHaveBeenCalledTimes(6);
  });
  it('invalidates permanently on background, disconnect, local mutation, abort, account epoch removal and TTL', async () => {
    const actions: ((
      h: ReturnType<typeof harness>,
      p: PreparedReminderPlan,
    ) => void | Promise<void>)[] = [
      () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      },
      () => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      },
      (h) => {
        h.client.getMutationCache().build(h.client, { mutationFn: async () => undefined });
      },
      (h) => h.controller.abort(),
      (h) => {
        h.client.removeQueries({ queryKey: accountQueryKeys.me(owner) });
        h.client.setQueryData(accountQueryKeys.me(owner), { id: owner });
      },
      (h, p) => {
        h.setTime(anchor + 30000);
        expect(p.isCurrent()).toBe(false);
        h.setTime(anchor);
      },
    ];
    for (const action of actions) {
      const h = harness(),
        p = await h.prepare();
      expect(p.isCurrent()).toBe(true);
      await action(h, p);
      expect(p.isCurrent()).toBe(false);
      p.dispose();
    }
  });
  it('aborts pending snapshot and blocks late response when mutation begins', async () => {
    const h = harness();
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    h.get.mockImplementation(async (path) => {
      if (path !== '/workouts') return { response: { status: 200 }, data: settings };
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return page([item()]);
    });
    const pending = h.prepare();
    await started;
    h.client.getMutationCache().build(h.client, { mutationFn: async () => undefined });
    expect((h.get.mock.calls[1]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    release();
    const result = await pending;
    expect(result.plan).toEqual({ kind: 'blocked', reason: 'scope' });
    expect(result.isCurrent()).toBe(false);
  });
});
