import {
  matchesNativeReminder,
  REMINDER_PREFIX,
  type VerifiedReminder,
} from './native-reminder-reconciliation';
import { LOCAL_REMINDER_PLAN_LIMIT } from './local-reminder-plan';

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Memory only, populated from the final verified OS inventory. No network,
 * crypto, native I/O, timers or persistent account data in the handler. */
export class ForegroundReminderAdmission {
  private entries = new Map<string, VerifiedReminder>();

  clear() {
    this.entries.clear();
  }

  replace(entries: readonly VerifiedReminder[], pending: number) {
    this.clear();
    if (
      !Number.isSafeInteger(pending) ||
      pending < 0 ||
      pending > LOCAL_REMINDER_PLAN_LIMIT ||
      entries.length !== pending
    )
      return;
    for (const entry of entries) {
      if (
        !entry.identifier.startsWith(REMINDER_PREFIX + 'v1.') ||
        !/^[a-f0-9]{64}$/.test(entry.identifier.slice((REMINDER_PREFIX + 'v1.').length)) ||
        this.entries.has(entry.identifier) ||
        !Number.isSafeInteger(entry.dueAt) ||
        !['android', 'ios'].includes(entry.platform)
      ) {
        this.clear();
        return;
      }
      this.entries.set(entry.identifier, { ...entry });
    }
  }

  consume(notification: unknown, now: number): boolean {
    const request = object(object(notification)?.request);
    const identifier = request?.identifier;
    if (typeof identifier !== 'string' || !Number.isFinite(now)) return false;
    const entry = this.entries.get(identifier);
    if (!entry) return false;
    // A delayed delivery may cross a quiet-hour boundary. Restrict to
    // the original due minute and never admit early delivery. One shot.
    if (now < entry.dueAt || Math.floor(now / 60000) !== Math.floor(entry.dueAt / 60000))
      return false;
    if (
      !matchesNativeReminder(
        { identifier, content: request?.content, trigger: request?.trigger },
        entry,
        entry.platform,
      )
    )
      return false;
    this.entries.delete(identifier);
    return true;
  }
}
