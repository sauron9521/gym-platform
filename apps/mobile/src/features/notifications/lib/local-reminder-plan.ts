import { z } from 'zod';
import { parseInstant, isIanaTimezone } from '@gym/datetime';
import { notificationQuietHoursAt, workoutReminderDueAt } from '@gym/domain';
import { notificationSettingsSchema } from './settings-contract';

/** Preparatory pure planner only. Caller must obtain fresh owner-scoped
 * settings and a complete bounded snapshot, never assume cached data is fresh.
 * No native IDs, storage, prompts, listeners or scheduling side effects. */
const workoutSchema = z.object({
  id: z.uuid(),
  athleteId: z.uuid(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  scheduledAt: z.string(),
});
type BlockReason = 'scope' | 'permission' | 'snapshot' | 'settings' | 'consent';
export type ReminderPlan =
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'ready'; reminders: ReadonlyArray<{ workoutId: string; dueAt: string }> };

// Proposed conservative per-installation ceiling, not an enabled OS policy.
// Final lifecycle implementation must also account for other pending requests.
export const LOCAL_REMINDER_PLAN_LIMIT = 32;

export function planLocalReminders(input: {
  ownerId: unknown;
  now: unknown;
  permission: unknown;
  snapshotComplete: boolean;
  settings: unknown;
  workouts: unknown;
}): ReminderPlan {
  const blocked = (reason: BlockReason): ReminderPlan => ({ kind: 'blocked', reason });
  const owner = z.uuid().safeParse(input.ownerId);
  const now = parseInstant(input.now);
  if (!owner.success || !now) return blocked('scope');
  if (input.permission !== 'granted') return blocked('permission');
  if (input.snapshotComplete !== true) return blocked('snapshot');
  const parsed = notificationSettingsSchema.safeParse(input.settings);
  if (!parsed.success) return blocked('settings');
  const settings = parsed.data;
  const { timezone } = settings;
  if (!isIanaTimezone(timezone) || notificationQuietHoursAt(now, timezone, settings) === 'invalid')
    return blocked('settings');
  const consent = settings.preferences.find(
    (p) => p.category === 'WORKOUT' && p.channel === 'LOCAL_REMINDER',
  );
  const consentedAt = parseInstant(consent?.consentedAt);
  if (!consent?.enabled || !consentedAt || consentedAt.getTime() > now.getTime())
    return blocked('consent');

  const rows = z.array(workoutSchema).max(1000).safeParse(input.workouts);
  if (!rows.success) return blocked('snapshot');
  const seen = new Set<string>();
  const reminders: Array<{ workoutId: string; dueAt: string }> = [];
  for (const row of rows.data) {
    const scheduledAt = parseInstant(row.scheduledAt);
    if (row.athleteId !== owner.data || seen.has(row.id.toLowerCase()) || !scheduledAt)
      return blocked('snapshot');
    seen.add(row.id.toLowerCase());
    const due = workoutReminderDueAt({
      status: row.status,
      scheduledAt,
      now,
      timezone,
      settings,
      consent: true,
    });
    if (due) reminders.push({ workoutId: row.id, dueAt: due.toISOString() });
  }
  reminders.sort(
    (a, b) =>
      Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.workoutId.localeCompare(b.workoutId, 'en'),
  );
  return { kind: 'ready', reminders: reminders.slice(0, LOCAL_REMINDER_PLAN_LIMIT) };
}
