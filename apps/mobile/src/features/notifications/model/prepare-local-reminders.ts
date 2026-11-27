import { focusManager, onlineManager, type QueryClient } from '@tanstack/react-query';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';
import { planLocalReminders, type ReminderPlan } from '../lib/local-reminder-plan';
import type { DevicePermission } from '../lib/notification-policy';
import type { InboxScope } from '../services/inbox-api';
import { readNotificationSettings } from '../services/settings-api';
import { readReminderWorkouts } from '../services/reminder-snapshot';

// Short-lived in-memory evidence only, never persisted or reused from cache.
const EVIDENCE_TTL_MS = 30_000;

export type PreparedReminderPlan = {
  plan: ReminderPlan;
  isCurrent: () => boolean;
  dispose: () => void;
};

/** No scheduler or subscription is mounted by this module. The future
 * coordinator owns the lifetime of each prepared plan and MUST dispose it
 * after use. Invalidating evidence aborts reads and permanently fences writes. */
export async function prepareLocalReminders(input: {
  client: QueryClient;
  scope: InboxScope;
  readPermission: () => Promise<DevicePermission>;
  signal: AbortSignal;
  now?: () => number;
}): Promise<PreparedReminderPlan> {
  const { client, scope, signal } = input;
  const now = input.now ?? Date.now;
  const anchor = now();
  const controller = new AbortController();
  const keyPrefixes = [
    accountQueryKeys.me(scope.ownerId),
    accountQueryKeys.workouts(scope.ownerId),
    accountQueryKeys.notificationSettings(scope.ownerId),
  ];
  const invalidate = () => controller.abort();
  const current = () => {
    const observed = now();
    const valid =
      !controller.signal.aborted &&
      !signal.aborted &&
      scope.isCurrent() &&
      hasAthleteAccess(scope.capabilities) &&
      onlineManager.isOnline() &&
      focusManager.isFocused() &&
      client.isMutating() === 0 &&
      observed >= anchor &&
      observed - anchor < EVIDENCE_TTL_MS;
    if (!valid) invalidate();
    return valid;
  };
  const unsubscribe = [
    client.getQueryCache().subscribe((event) => {
      if (
        !keyPrefixes.some((prefix) => prefix.every((part, i) => event.query.queryKey[i] === part))
      )
        return;
      if (
        event.type === 'removed' ||
        (event.type === 'updated' &&
          (event.action.type === 'invalidate' || event.action.type === 'success'))
      )
        invalidate();
    }),
    // Deliberately conservative: any pending local mutation can change
    // reminder evidence, even on transport ambiguity. No write replay.
    client.getMutationCache().subscribe((event) => {
      if (event.type === 'added' || (event.type === 'updated' && event.action.type === 'pending'))
        invalidate();
    }),
    onlineManager.subscribe((online) => {
      if (!online) invalidate();
    }),
    focusManager.subscribe((focused) => {
      if (!focused) invalidate();
    }),
  ];
  signal.addEventListener('abort', invalidate, { once: true });
  const dispose = () => {
    invalidate();
    signal.removeEventListener('abort', invalidate);
    for (const off of unsubscribe) off();
  };
  const blocked = (
    reason: Extract<ReminderPlan, { kind: 'blocked' }>['reason'],
  ): PreparedReminderPlan => {
    dispose();
    return { plan: { kind: 'blocked', reason }, isCurrent: () => false, dispose };
  };
  try {
    if (!current()) return blocked('scope');
    const permission = await input.readPermission();
    if (!current()) return blocked('scope');
    if (permission !== 'granted') return blocked('permission');
    const guardedScope = { ...scope, isCurrent: current };
    const settings = await readNotificationSettings(guardedScope, controller.signal);
    if (!current()) return blocked('scope');
    // Avoid reading workouts when consent/zone/settings are not usable.
    const preliminary = planLocalReminders({
      ownerId: scope.ownerId,
      now: new Date(now()).toISOString(),
      permission,
      snapshotComplete: true,
      settings,
      workouts: [],
    });
    if (preliminary.kind === 'blocked') return blocked(preliminary.reason);
    const workouts = await readReminderWorkouts(guardedScope, new Date(anchor), controller.signal);
    if (!current()) return blocked('scope');
    const plan = planLocalReminders({
      ownerId: scope.ownerId,
      now: new Date(now()).toISOString(),
      permission,
      snapshotComplete: true,
      settings,
      workouts,
    });
    if (plan.kind === 'blocked') return blocked(plan.reason);
    return { plan, isCurrent: current, dispose };
  } catch {
    return blocked(current() ? 'snapshot' : 'scope');
  }
}
