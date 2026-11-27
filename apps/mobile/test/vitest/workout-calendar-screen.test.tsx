import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';

import { WorkoutCalendarScreen } from '@/screens/workouts/ui/workout-calendar-screen';
import {
  CalendarDataError,
  useWorkoutCalendarQuery,
} from '@/features/workouts/model/workout-calendar-query';
import {
  localCalendarDayKey,
  monthOf,
  shiftCalendarMonth,
  shiftCalendarDays,
  startCalendarWeek,
} from '@gym/datetime';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';

const push = vi.hoisted(() => vi.fn());
const refetch = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/workouts/model/workout-calendar-query', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/workouts/model/workout-calendar-query')>();
  return { ...actual, useWorkoutCalendarQuery: vi.fn() };
});
const now = new Date();
const selected = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1, 12);
const workout = {
  id: 'workout-one',
  athleteId: 'owner-one',
  title: 'Strength A',
  status: 'COMPLETED',
  scheduledAt: selected.toISOString(),
};
function prepare(overrides: Record<string, unknown> = {}) {
  vi.mocked(useWorkoutCalendarQuery).mockReturnValue({
    data: [workout],
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useWorkoutCalendarQuery>);
}
const screen = (locale: 'uk' | 'en' = 'uk') =>
  render(
    <IntlProvider locale={locale} messages={getMobileMessages(locale)}>
      <WorkoutCalendarScreen />
    </IntlProvider>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  prepare();
});
afterEach(async () => {
  await cleanup();
});
describe('WorkoutCalendarScreen', () => {
  it('selects a day, shows status and navigates to workout details', async () => {
    const view = await screen();
    expect(view.queryByText(workout.title)).toBeNull();
    await fireEvent.press(view.getByTestId(`calendar-day-${localCalendarDayKey(selected)}`));
    expect(view.getByText(workout.title)).toBeTruthy();
    expect(
      view.getByTestId(`calendar-day-${localCalendarDayKey(selected)}`).props.accessibilityState
        .selected,
    ).toBe(true);
    await fireEvent.press(view.getByText(workout.title));
    expect(push).toHaveBeenCalledWith({ pathname: '/workouts/[id]', params: { id: workout.id } });
  });
  it('shows derived missed and completed-late labels without changing canonical status', async () => {
    const yesterday = shiftCalendarDays(new Date(), -1);
    yesterday.setHours(12, 0, 0, 0);
    const missed = {
      ...workout,
      id: 'missed',
      title: 'Missed session',
      status: 'PLANNED',
      scheduledAt: yesterday.toISOString(),
    };
    const late = {
      ...workout,
      id: 'late',
      title: 'Late session',
      status: 'COMPLETED',
      scheduledAt: yesterday.toISOString(),
      completedAt: new Date().toISOString(),
    };
    prepare({ data: [missed, late] });
    const view = await screen('en');
    // Navigate to the prior month when today is its first day.
    if (monthOf(yesterday).month !== monthOf(new Date()).month)
      await fireEvent.press(view.getByTestId('calendar-previous'));
    await fireEvent.press(view.getByTestId(`calendar-day-${localCalendarDayKey(yesterday)}`));
    expect(view.getByText('Missed session')).toBeTruthy();
    expect(view.getByText(/ · Missed$/)).toBeTruthy();
    expect(view.getByText(/ · Completed late$/)).toBeTruthy();
    expect(missed.status).toBe('PLANNED');
    expect(late.status).toBe('COMPLETED');
  });
  it('navigates months and returns to today', async () => {
    const view = await screen('en');
    await fireEvent.press(view.getByTestId('calendar-next'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith(shiftCalendarMonth(monthOf(now), 1));
    await fireEvent.press(view.getByTestId('calendar-today'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith(monthOf(now));
    expect(view.getByText('Today')).toBeTruthy();
  });
  it('shows loading, empty and bounded-data error states without misleading stale results', async () => {
    prepare({ data: undefined, isPending: true });
    const loading = await screen('en');
    expect(loading.getByText('Loading calendar…')).toBeTruthy();
    await loading.unmount();
    prepare({ data: [] });
    const empty = await screen('en');
    expect(empty.getByText('No scheduled workouts this month.')).toBeTruthy();
    await empty.unmount();
    prepare({ isError: true, error: new CalendarDataError('tooMany') });
    const failed = await screen('en');
    expect(
      failed.getByText('Too many workouts this month. The full calendar is unavailable.'),
    ).toBeTruthy();
    expect(failed.queryByTestId(`calendar-day-${localCalendarDayKey(selected)}`)).toBeNull();
    await fireEvent.press(failed.getByTestId('calendar-retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it('keeps selected day when switching views and lists workouts for all seven days', async () => {
    const first = startCalendarWeek(selected);
    const last = shiftCalendarDays(first, 6);
    const weekWorkouts = [
      { ...workout, id: 'last', title: 'Sunday workout', scheduledAt: last.toISOString() },
      { ...workout, id: 'first', title: 'Monday workout', scheduledAt: first.toISOString() },
    ];
    prepare({ data: weekWorkouts });
    const view = await screen('en');
    await fireEvent.press(view.getByTestId(`calendar-day-${localCalendarDayKey(selected)}`));
    await fireEvent.press(view.getByTestId('calendar-mode-week'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith({ weekStart: first });
    expect(view.getByTestId('calendar-mode-week').props.accessibilityState.selected).toBe(true);
    expect(view.getByText('Weekly workouts')).toBeTruthy();
    expect(view.getByText('Monday workout')).toBeTruthy();
    expect(view.getByText('Sunday workout')).toBeTruthy();
    expect(view.getAllByTestId(/^calendar-day-/)).toHaveLength(7);
    expect(view.getAllByTestId(/^calendar-agenda-/)).toHaveLength(7);
    await fireEvent.press(view.getByText('Sunday workout'));
    expect(push).toHaveBeenCalledWith({ pathname: '/workouts/[id]', params: { id: 'last' } });
    await fireEvent.press(view.getByTestId(`calendar-day-${localCalendarDayKey(last)}`));
    await fireEvent.press(view.getByTestId('calendar-mode-month'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith(monthOf(last));
    expect(
      view.getByTestId(`calendar-day-${localCalendarDayKey(last)}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it('navigates weeks by local dates and returns to today without changing mode', async () => {
    const view = await screen('en');
    await fireEvent.press(view.getByTestId('calendar-mode-week'));
    await fireEvent.press(view.getByTestId('calendar-next'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith({
      weekStart: startCalendarWeek(shiftCalendarDays(now, 7)),
    });
    expect(view.getByLabelText('Next week')).toBeTruthy();
    await fireEvent.press(view.getByTestId('calendar-previous'));
    expect(useWorkoutCalendarQuery).toHaveBeenLastCalledWith({ weekStart: startCalendarWeek(now) });
    await fireEvent.press(view.getByTestId('calendar-today'));
    expect(view.getByTestId('calendar-mode-week').props.accessibilityState.selected).toBe(true);
    expect(
      view.getByTestId(`calendar-day-${localCalendarDayKey(now)}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it('uses week-specific empty and limit messages and hides stale agenda on errors', async () => {
    prepare({ data: [] });
    const view = await screen('en');
    await fireEvent.press(view.getByTestId('calendar-mode-week'));
    expect(view.getByText('No scheduled workouts this week.')).toBeTruthy();
    expect(view.queryByText('No scheduled workouts this month.')).toBeNull();
    await view.unmount();
    prepare({ isError: true, error: new CalendarDataError('tooMany') });
    const failed = await screen('en');
    await fireEvent.press(failed.getByTestId('calendar-mode-week'));
    expect(
      failed.getByText('Too many workouts this week. The full calendar is unavailable.'),
    ).toBeTruthy();
    expect(failed.queryByTestId('calendar-week-agenda')).toBeNull();
  });
});
