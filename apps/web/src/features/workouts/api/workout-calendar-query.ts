import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { type WorkoutListItem } from '../lib/workouts-list';
import { workoutQueryKeys } from '../lib/workout-query-keys';
import { calendarMonthBounds, type CalendarMonth } from '@gym/datetime';

export type CalendarFailure = 'request' | 'tooMany' | 'incomplete';

export class CalendarRequestError extends Error {
  constructor(
    readonly status?: number,
    readonly reason: CalendarFailure = 'request',
  ) {
    super(reason);
    this.name = 'CalendarRequestError';
  }
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export function workoutCalendarQueryOptions(month: CalendarMonth) {
  const { from, to } = calendarMonthBounds(month);
  return queryOptions({
    queryKey: [...workoutQueryKeys.all, 'calendar', from, to],
    queryFn: async ({ signal }): Promise<WorkoutListItem[]> => {
      const workouts: WorkoutListItem[] = [];
      const ids = new Set<string>();
      try {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const { data, response } = await webApi.GET('/workouts', {
            signal,
            params: {
              query: {
                page,
                limit: PAGE_SIZE,
                view: 'summary',
                scheduledFrom: from,
                scheduledTo: to,
              },
            },
          });
          if (response.status !== 200 || !data) throw new CalendarRequestError(response.status);
          if (data.meta.totalPages > MAX_PAGES) {
            throw new CalendarRequestError(undefined, 'tooMany');
          }
          for (const item of data.data) {
            if (!ids.has(item.id)) {
              ids.add(item.id);
              workouts.push(item);
            }
          }
          if (page >= data.meta.totalPages) return workouts;
        }
        throw new CalendarRequestError(undefined, 'incomplete');
      } catch (error) {
        if (error instanceof CalendarRequestError || signal.aborted) throw error;
        throw new CalendarRequestError();
      }
    },
    retry: false,
  });
}
