import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';

import { WorkoutCalendarScreen } from '@/screens/workouts/ui/workout-calendar-screen';
import {
  CalendarDataError,
  useWorkoutCalendarQuery,
} from '@/features/workouts/model/workout-calendar-query';
import {
  localWorkoutDayKey,
  monthOf,
  shiftCalendarMonth,
} from '@/features/workouts/lib/calendar-month';
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
    await fireEvent.press(view.getByTestId(`calendar-day-${localWorkoutDayKey(selected)}`));
    expect(view.getByText(workout.title)).toBeTruthy();
    expect(
      view.getByTestId(`calendar-day-${localWorkoutDayKey(selected)}`).props.accessibilityState
        .selected,
    ).toBe(true);
    await fireEvent.press(view.getByText(workout.title));
    expect(push).toHaveBeenCalledWith({ pathname: '/workouts/[id]', params: { id: workout.id } });
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
    expect(failed.queryByTestId(`calendar-day-${localWorkoutDayKey(selected)}`)).toBeNull();
    await fireEvent.press(failed.getByTestId('calendar-retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
