import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@gym/i18n';
import { WorkoutCalendar } from '@/features/workouts/ui/workout-calendar';
import { workoutCalendarQueryOptions } from '@/features/workouts/api/workout-calendar-query';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/features/workouts/api/workout-calendar-query', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/workouts/api/workout-calendar-query')>();
  return { ...actual, workoutCalendarQueryOptions: vi.fn() };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Web calendar derived status', () => {
  it('displays both historical derived statuses and preserves source rows', async () => {
    // Freeze the clock for a deterministic same-month historical day.
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    const scheduledAt = new Date(2026, 10, 14, 12).toISOString();
    const rows = [
      {
        id: 'planned',
        title: 'Planned session',
        status: 'PLANNED',
        scheduledAt,
        completedAt: null,
      },
      {
        id: 'completed',
        title: 'Completed session',
        status: 'COMPLETED',
        scheduledAt,
        completedAt: new Date().toISOString(),
      },
      {
        id: 'cancelled',
        title: 'Cancelled session',
        status: 'CANCELLED',
        scheduledAt,
        completedAt: null,
      },
    ];
    vi.mocked(workoutCalendarQueryOptions).mockReturnValue({
      queryKey: ['calendar-test'],
      queryFn: async () => rows,
      initialData: rows,
    } as unknown as ReturnType<typeof workoutCalendarQueryOptions>);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      render(
        <NextIntlClientProvider locale="en" messages={getMessages('en')} timeZone="UTC">
          <QueryClientProvider client={client}>
            <WorkoutCalendar />
          </QueryClientProvider>
        </NextIntlClientProvider>,
      );
      expect(screen.getByText('Missed')).toBeTruthy();
      expect(screen.getByText('Completed late')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Cancelled session' }).getAttribute('title')).toBe(
        'Cancelled session: Cancelled',
      );
      expect(rows.map((row) => row.status)).toEqual(['PLANNED', 'COMPLETED', 'CANCELLED']);
    } finally {
      client.clear();
      vi.useRealTimers();
    }
  });
});
