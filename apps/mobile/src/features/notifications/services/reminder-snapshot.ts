import { z } from 'zod';
import { parseInstant } from '@gym/datetime';
import { onlineManager } from '@tanstack/react-query';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { MobileSessionExpiredError, mobileReadError } from '@/shared/api/api-error-policy';
import { assertInboxCurrent, type InboxScope } from './inbox-api';

// Provisional bounded horizon in elapsed time, not device-local calendar days.
// Use a single page; offset pagination across mutable workouts is not a snapshot.
export const REMINDER_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 100;
const pageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.uuid(),
        athleteId: z.uuid(),
        status: z.literal('PLANNED'),
        scheduledAt: z.string(),
      }),
    )
    .max(LIMIT),
  meta: z.object({
    total: z.int().nonnegative().max(LIMIT),
    totalPages: z.int().min(0).max(1),
    skip: z.literal(0),
    take: z.literal(LIMIT),
  }),
});

export async function readReminderWorkouts(scope: InboxScope, anchor: Date, signal: AbortSignal) {
  const check = () => {
    assertInboxCurrent(scope, signal);
    if (!onlineManager.isOnline() || !hasAthleteAccess(scope.capabilities))
      throw new Error('Reminder scope unavailable');
  };
  check();
  const from = anchor.getTime();
  const to = from + REMINDER_HORIZON_MS;
  if (!Number.isFinite(from) || !Number.isFinite(new Date(to).getTime()))
    throw new Error('Invalid reminder horizon');
  const api = scope.getScopedApi(
    () => scope.isCurrent() && !signal.aborted && onlineManager.isOnline(),
  );
  if (!api) throw new Error('Reminder session unavailable');
  const result = await api.GET('/workouts', {
    signal,
    params: {
      query: {
        page: 1,
        limit: LIMIT,
        view: 'summary',
        status: 'PLANNED',
        sort: 'scheduledAtAsc',
        scheduledFrom: anchor.toISOString(),
        scheduledTo: new Date(to).toISOString(),
      },
    },
  });
  check();
  if (result.response.status === 401) {
    await scope.signOut();
    throw new MobileSessionExpiredError();
  }
  if (result.response.status !== 200)
    throw mobileReadError(result.response.status, 'Reminder workouts request failed');
  const parsed = pageSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('Incomplete reminder snapshot');
  const { data, meta } = parsed.data;
  if (data.length !== meta.total || meta.totalPages !== (meta.total === 0 ? 0 : 1))
    throw new Error('Incomplete reminder snapshot');
  const seen = new Set<string>();
  let previous = from;
  for (const item of data) {
    const instant = parseInstant(item.scheduledAt)?.getTime();
    if (
      item.athleteId !== scope.ownerId ||
      seen.has(item.id.toLowerCase()) ||
      instant === undefined ||
      instant < previous ||
      instant > to
    )
      throw new Error('Invalid reminder snapshot');
    seen.add(item.id.toLowerCase());
    previous = instant;
  }
  check();
  return data;
}
