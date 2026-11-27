import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { accountQueryKeys } from '@/shared/api/query-client';
import { mobileReadError, MobileSessionExpiredError } from '@/shared/api/api-error-policy';
import type { createMobileApi } from '@/shared/api/client';
import { calendarPeriodBounds, type CalendarPeriod } from '../lib/calendar-month';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const itemSchema = z.object({
  id: z.uuid(),
  athleteId: z.uuid(),
  title: z.string(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  scheduledAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
const pageSchema = z.object({
  data: z.array(itemSchema).max(PAGE_SIZE),
  meta: z.object({
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
    take: z.literal(PAGE_SIZE),
  }),
});
export type CalendarWorkout = z.infer<typeof itemSchema>;

export class CalendarDataError extends Error {
  constructor(readonly reason: 'tooMany' | 'incomplete' | 'scopeChanged') {
    super(reason);
    this.name = 'CalendarDataError';
  }
}

export const calendarQueryKey = (ownerId: string, period: CalendarPeriod) => {
  const { from, to } = calendarPeriodBounds(period);
  return [...accountQueryKeys.workouts(ownerId), 'calendar', from, to] as const;
};

/** All-or-nothing summary pagination. A changing offset collection is not a
 * reliable snapshot: fail visibly on detected gaps/duplicates instead of
 * displaying a silently incomplete calendar. */
export async function readWorkoutCalendar({
  api,
  ownerId,
  period,
  signal,
  isCurrent,
  onExpired,
}: {
  api: ReturnType<typeof createMobileApi>;
  ownerId: string;
  period: CalendarPeriod;
  signal: AbortSignal;
  isCurrent: () => boolean;
  onExpired: () => Promise<void>;
}): Promise<CalendarWorkout[]> {
  const { from, to } = calendarPeriodBounds(period);
  const records = new Map<string, CalendarWorkout>();
  const checkScope = () => {
    if (signal.aborted || !isCurrent()) throw new CalendarDataError('scopeChanged');
  };
  let expectedTotal: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    checkScope();
    const result = await api.GET('/workouts', {
      signal,
      params: {
        query: { page, limit: PAGE_SIZE, view: 'summary', scheduledFrom: from, scheduledTo: to },
      },
    });
    checkScope();
    if (result.response.status === 401) {
      await onExpired();
      throw new MobileSessionExpiredError();
    }
    if (result.response.status !== 200)
      throw mobileReadError(result.response.status, 'calendar-request-failed');
    const parsed = pageSchema.safeParse(result.data);
    if (!parsed.success) throw new CalendarDataError('incomplete');
    const { data, meta } = parsed.data;
    if (meta.totalPages > MAX_PAGES || meta.total > MAX_PAGES * PAGE_SIZE)
      throw new CalendarDataError('tooMany');
    if (
      meta.totalPages !== Math.ceil(meta.total / PAGE_SIZE) ||
      meta.skip !== (page - 1) * PAGE_SIZE ||
      data.length !== Math.max(0, Math.min(PAGE_SIZE, meta.total - meta.skip)) ||
      (expectedTotal !== undefined && meta.total !== expectedTotal)
    ) {
      throw new CalendarDataError('incomplete');
    }
    expectedTotal = meta.total;
    for (const item of data) {
      if (
        item.athleteId !== ownerId ||
        Date.parse(item.scheduledAt) < Date.parse(from) ||
        Date.parse(item.scheduledAt) > Date.parse(to) ||
        records.has(item.id)
      ) {
        throw new CalendarDataError('incomplete');
      }
      records.set(item.id, item);
    }
    if (page >= meta.totalPages) {
      if (records.size !== expectedTotal) throw new CalendarDataError('incomplete');
      return [...records.values()];
    }
  }
  throw new CalendarDataError('incomplete');
}

export function useWorkoutCalendarQuery(period: CalendarPeriod) {
  const { account, capabilities, getScopedApi, signOut } = useAuth();
  const client = useQueryClient();
  const ownerId = account?.id;
  return useQuery({
    queryKey: calendarQueryKey(ownerId ?? 'signed-out', period),
    enabled: Boolean(ownerId && hasAthleteAccess(capabilities)),
    queryFn: async ({ signal }) => {
      const isCurrent = () =>
        Boolean(ownerId && !signal.aborted && client.getQueryData(accountQueryKeys.me(ownerId)));
      if (!ownerId || !hasAthleteAccess(capabilities) || !isCurrent())
        throw new CalendarDataError('scopeChanged');
      const api = getScopedApi(isCurrent);
      if (!api) throw new CalendarDataError('scopeChanged');
      return readWorkoutCalendar({ api, ownerId, period, signal, isCurrent, onExpired: signOut });
    },
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}
