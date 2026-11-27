import { z } from 'zod';
import { parseInstant } from '@gym/datetime';
import { getFlatMessages, isLocale, type Locale } from '@gym/i18n';
import { LOCAL_REMINDER_PLAN_LIMIT, type ReminderPlan } from './local-reminder-plan';
import { WORKOUT_REMINDER_CHANNEL } from './native-notification-permission';

export const REMINDER_PREFIX = 'ovranto.workout-reminder.';
const VERSION = 'v1.';
const ownId = (id: string) => id.startsWith(REMINDER_PREFIX);
const desiredSchema = z
  .array(z.strictObject({ workoutId: z.uuid(), dueAt: z.string() }))
  .max(LOCAL_REMINDER_PLAN_LIMIT);
// Conservative shared pending budget, below the iOS system ceiling. Not
// a promise that the OS accepts this many; verify the final inventory.
const TOTAL_PENDING_BUDGET = 48;
const MIN_LEAD_MS = 5000;

export type PendingReminder = {
  identifier: string;
  content: unknown;
  trigger: unknown;
};
export type NativeReminderPort = {
  list(): Promise<readonly PendingReminder[]>;
  cancel(identifier: string): Promise<void>;
  schedule(input: {
    identifier: string;
    dueAt: number;
    title: string;
    body: string;
  }): Promise<string>;
  canSchedule(): Promise<boolean>;
  digest(value: string): Promise<string>;
  now(): number;
  platform: 'android' | 'ios';
};
export type ReconcileResult =
  { kind: 'ready'; pending: number } | { kind: 'blocked' | 'failed' | 'busy' };
type Desired = { identifier: string; dueAt: number; title: string; body: string };

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function matches(row: PendingReminder, item: Desired, platform: NativeReminderPort['platform']) {
  const content = object(row.content);
  const trigger = object(row.trigger);
  const data = object(content?.data);
  if (
    content?.title !== item.title ||
    content?.body !== item.body ||
    !data ||
    Object.keys(data).length !== 0 ||
    trigger?.repeats !== false
  )
    return false;
  if (platform === 'android')
    return (
      trigger.type === 'date' &&
      trigger.value === item.dueAt &&
      trigger.channelId === WORKOUT_REMINDER_CHANNEL &&
      trigger.delivery === 'bestEffort'
    );
  // Expo iOS serializes absolute DATE as a non-repeating time interval.
  // The opaque identifier binds the intended instant, but the serialized
  // interval cannot independently prove the original absolute fire time.
  return (
    trigger.type === 'timeInterval' &&
    typeof trigger.seconds === 'number' &&
    Number.isFinite(trigger.seconds) &&
    trigger.seconds > 0
  );
}

async function inventory(port: NativeReminderPort) {
  const rows = await port.list();
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row.identifier !== 'string' || !row.identifier)
  )
    throw new Error('Invalid pending inventory');
  return rows;
}

async function clearManaged(port: NativeReminderPort) {
  // No cancelAll: leave unrelated pending requests untouched.
  const ids = new Set(
    (await inventory(port)).filter((row) => ownId(row.identifier)).map((row) => row.identifier),
  );
  for (const id of ids) {
    try {
      await port.cancel(id);
    } catch {
      /* Continue cleanup, verify below. */
    }
  }
  return !(await inventory(port)).some((row) => ownId(row.identifier));
}

let inFlight = false;
/** Unwired native reconciliation. Future coordinator must provide a fresh
 * owner/session/settings snapshot and revoke the fence before lifecycle
 * cleanup. A busy result is not success; caller must retry after settlement. */
export async function reconcileNativeReminders(
  port: NativeReminderPort,
  input: {
    ownerId: string;
    locale: Locale;
    plan: ReminderPlan;
    isCurrent: () => boolean;
  },
): Promise<ReconcileResult> {
  if (inFlight) return { kind: 'busy' };
  inFlight = true;
  try {
    const current = () => input.isCurrent();
    if (
      !current() ||
      input.plan.kind !== 'ready' ||
      !z.uuid().safeParse(input.ownerId).success ||
      !isLocale(input.locale)
    ) {
      return { kind: (await clearManaged(port)) ? 'blocked' : 'failed' };
    }
    const parsed = desiredSchema.safeParse(input.plan.reminders);
    if (
      !parsed.success ||
      new Set(parsed.data.map((row) => row.workoutId.toLowerCase())).size !== parsed.data.length
    ) {
      return { kind: (await clearManaged(port)) ? 'blocked' : 'failed' };
    }
    const messages = getFlatMessages(input.locale);
    const title = messages['mobile.notificationSettings.reminderNotificationTitle']!;
    const body = messages['mobile.notificationSettings.reminderNotificationBody']!;
    const desired: Desired[] = [];
    for (const row of parsed.data) {
      const due = parseInstant(row.dueAt);
      if (!due) throw new Error('Invalid due instant');
      // iOS DATE truncates milliseconds. Use an identical second-aligned
      // instant on both platforms, never round earlier than intended.
      const dueAt = Math.ceil(due.getTime() / 1000) * 1000;
      // Rounding must not move the candidate into a different quiet-hour minute.
      if (Math.floor(dueAt / 60000) !== Math.floor(due.getTime() / 60000)) continue;
      if (dueAt <= port.now() + MIN_LEAD_MS) continue;
      const hash = await port.digest(
        JSON.stringify([
          VERSION,
          input.ownerId.toLowerCase(),
          row.workoutId.toLowerCase(),
          dueAt,
          title,
          body,
        ]),
      );
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid reminder digest');
      desired.push({ identifier: REMINDER_PREFIX + VERSION + hash, dueAt, title, body });
    }
    if (!current() || !(await port.canSchedule()) || !current())
      return { kind: (await clearManaged(port)) ? 'blocked' : 'failed' };
    const rows = await inventory(port);
    const budget = Math.max(
      0,
      Math.min(
        LOCAL_REMINDER_PLAN_LIMIT,
        TOTAL_PENDING_BUDGET - rows.filter((row) => !ownId(row.identifier)).length,
      ),
    );
    desired.sort((a, b) => a.dueAt - b.dueAt || a.identifier.localeCompare(b.identifier, 'en'));
    const target = new Map(desired.slice(0, budget).map((item) => [item.identifier, item]));
    if (new Set(desired.map((item) => item.identifier)).size !== desired.length)
      throw new Error('Duplicate native identifier');
    const keep = new Set<string>();
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.identifier, (counts.get(row.identifier) ?? 0) + 1);
    const removed = new Set<string>();
    for (const row of rows) {
      if (!ownId(row.identifier) || removed.has(row.identifier)) continue;
      const item = target.get(row.identifier);
      if (item && counts.get(row.identifier) === 1 && matches(row, item, port.platform))
        keep.add(row.identifier);
      else {
        await port.cancel(row.identifier);
        removed.add(row.identifier);
      }
    }
    const after = await inventory(port);
    if (after.some((row) => ownId(row.identifier) && !keep.has(row.identifier)))
      throw new Error('Cancellation not verified');
    for (const item of target.values()) {
      if (!current()) throw new Error('Reminder scope changed');
      if (keep.has(item.identifier)) continue;
      if (item.dueAt <= port.now() + MIN_LEAD_MS) {
        target.delete(item.identifier);
        continue;
      }
      if (!(await port.canSchedule()) || !current() || item.dueAt <= port.now() + MIN_LEAD_MS)
        throw new Error('Reminder admission changed');
      if ((await port.schedule(item)) !== item.identifier || !current())
        throw new Error('Ambiguous native schedule');
    }
    if (!current() || !(await port.canSchedule()) || !current())
      throw new Error('Reminder admission changed');
    const finalInventory = await inventory(port);
    const final = finalInventory.filter((row) => ownId(row.identifier));
    if (
      !current() ||
      final.length !== target.size ||
      (final.length > 0 && finalInventory.length > TOTAL_PENDING_BUDGET) ||
      final.some(
        (row) => target.get(row.identifier) && target.get(row.identifier)!.dueAt <= port.now(),
      ) ||
      new Set(final.map((row) => row.identifier)).size !== final.length ||
      final.some(
        (row) =>
          !target.has(row.identifier) || !matches(row, target.get(row.identifier)!, port.platform),
      )
    )
      throw new Error('Pending inventory mismatch');
    return { kind: 'ready', pending: final.length };
  } catch {
    // A rejected native call may have committed. Never replay the write;
    // attempt scoped cleanup, and report failure even when cleanup works.
    try {
      await clearManaged(port);
    } catch {
      /* Caller must reconcile again. */
    }
    return { kind: 'failed' };
  } finally {
    inFlight = false;
  }
}

export async function cancelManagedNativeReminders(
  port: NativeReminderPort,
): Promise<ReconcileResult> {
  if (inFlight) return { kind: 'busy' };
  inFlight = true;
  try {
    return (await clearManaged(port)) ? { kind: 'ready', pending: 0 } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  } finally {
    inFlight = false;
  }
}
