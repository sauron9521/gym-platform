import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { getFlatMessages, type Locale } from '@gym/i18n';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { ProgressScreen } from '@/screens/progress/ui/progress-screen';

const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/exercises/model/exercises-query', () => ({
  useExercisesQuery: vi.fn(),
}));
vi.mock('@/features/progress/model/workout-summary-query', () => ({
  useWorkoutSummary: vi.fn(),
}));

const refetch = vi.fn();
const initialStats = {
  workoutCount: 1,
  activeDays: 1,
  completedSets: 3,
  strengthVolumeKg: 0,
  asOf: '2026-11-17T10:00:00.000Z',
  daily: [{ date: '2026-11-17', strengthVolumeKg: 0 }],
};

function prepare(overrides: Record<string, unknown> = {}) {
  vi.mocked(useWorkoutSummary).mockReturnValue({
    data: initialStats,
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    error: null,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useWorkoutSummary>);
}

function screenFor(locale: Locale) {
  return render(
    <IntlProvider locale={locale} defaultLocale="uk" messages={getFlatMessages(locale)}>
      <ProgressScreen />
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  refetch.mockResolvedValue(undefined);
  prepare();
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: { pages: [{ data: [{ id: 'exercise-1', name: 'Жим лежачи', isArchived: false }] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
  } as unknown as ReturnType<typeof useExercisesQuery>);
});
afterEach(async () => {
  await cleanup();
});

describe('Mobile ProgressScreen locale and query regression', () => {
  it('navigates to the selected exercise without replacing the workout summary', async () => {
    const view = await screenFor('uk');
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    expect(push).toHaveBeenCalledExactlyOnceWith({
      pathname: '/progress/exercises/[id]',
      params: { id: 'exercise-1' },
    });
    expect(view.getByText('Тренувальний об’єм за днями')).toBeTruthy();
  });

  it.each([
    { locale: 'uk' as const, noVolume: 'За цей період немає записаного силового об’єму.' },
    { locale: 'en' as const, noVolume: 'No recorded strength volume in this period.' },
  ])('localizes a zero-strength-volume summary for $locale', async ({ locale, noVolume }) => {
    const view = await screenFor(locale);
    expect(view.getByText(noVolume)).toBeTruthy();
    expect(view.queryByLabelText(/2026: 125 kg/)).toBeNull();
    expect(view.getAllByText('1')).toHaveLength(2);
    expect(view.getByText('3')).toBeTruthy();
  });

  it('keeps the selected range and query arguments on locale change', async () => {
    const view = await screenFor('en');
    expect(useWorkoutSummary).toHaveBeenCalledWith('30d');
    expect(view.getByTestId('progress-range-7d').props.accessibilityLabel).toBe('Last 7 days');
    await fireEvent.press(view.getByTestId('progress-range-7d'));
    expect(useWorkoutSummary).toHaveBeenCalledWith('7d');
    expect(view.getByTestId('progress-range-7d').props.accessibilityState.selected).toBe(true);
    await view.rerender(
      <IntlProvider locale="uk" defaultLocale="uk" messages={getFlatMessages('uk')}>
        <ProgressScreen />
      </IntlProvider>,
    );
    expect(view.getByText('Мій прогрес')).toBeTruthy();
    expect(view.getByTestId('progress-range-7d').props.accessibilityLabel).toBe('Останні 7 днів');
    expect(view.getByTestId('progress-range-7d').props.accessibilityState.selected).toBe(true);
    expect(useWorkoutSummary).toHaveBeenCalledWith('7d');
  });

  it.each([
    {
      locale: 'uk' as const,
      error: 'Не вдалося завантажити статистику. Спробуйте ще раз.',
      retry: 'Повторити завантаження',
    },
    { locale: 'en' as const, error: 'Could not load statistics. Try again.', retry: 'Retry' },
  ])(
    'shows safe translated error and an explicit retry for $locale',
    async ({ locale, error, retry }) => {
      prepare({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error('SECRET_API_BODY'),
      });
      const view = await screenFor(locale);
      expect(view.getByText(error)).toBeTruthy();
      expect(view.queryByText('SECRET_API_BODY')).toBeNull();
      await fireEvent.press(view.getByTestId('progress-retry'));
      expect(view.getByText(retry)).toBeTruthy();
      expect(refetch).toHaveBeenCalledOnce();
    },
  );

  it('localizes English summary labels and preserves numeric metrics and API data', async () => {
    prepare({
      data: {
        ...initialStats,
        workoutCount: 4,
        activeDays: 3,
        completedSets: 9,
        strengthVolumeKg: 125.4,
      },
    });
    const view = await screenFor('en');
    expect(view.getByText('My progress')).toBeTruthy();
    expect(view.getByText('Exercise statistics')).toBeTruthy();
    expect(view.getByText('Workouts')).toBeTruthy();
    expect(view.getByText('Active days')).toBeTruthy();
    expect(view.getByText('Sets')).toBeTruthy();
    expect(view.getByText('Volume, kg')).toBeTruthy();
    expect(view.getByText('Daily training volume')).toBeTruthy();
    for (const metric of ['4', '3', '9', '125']) expect(view.getByText(metric)).toBeTruthy();
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.getByRole('button', { name: 'Жим лежачи' })).toBeTruthy();
    expect(view.getByText('Gym API data as of 11/17/2026')).toBeTruthy();
  });

  it('uses locale-specific chart bar accessibility with UTC-safe dates, preserving chart values', async () => {
    prepare({
      data: {
        ...initialStats,
        daily: [
          { date: '2026-11-17', strengthVolumeKg: 125.4 },
          { date: '2026-11-18', strengthVolumeKg: 75 },
        ],
      },
    });
    const view = await screenFor('en');
    expect(view.getByLabelText('Nov 17, 2026: 125 kg')).toBeTruthy();
    expect(view.getByLabelText('Nov 18, 2026: 75 kg')).toBeTruthy();
    await view.rerender(
      <IntlProvider locale="uk" defaultLocale="uk" messages={getFlatMessages('uk')}>
        <ProgressScreen />
      </IntlProvider>,
    );
    expect(view.getByText('Тренувальний об’єм за днями')).toBeTruthy();
    expect(view.getAllByLabelText(/17 .*2026.*: 125 кг/)).toHaveLength(1);
    expect(view.getAllByLabelText(/18 .*2026.*: 75 кг/)).toHaveLength(1);
  });

  it.each([
    { locale: 'uk' as const, message: 'Даних за цей період ще немає.' },
    { locale: 'en' as const, message: 'No data available for this period.' },
  ])('localizes the no-data state for $locale', async ({ locale, message }) => {
    prepare({ data: { ...initialStats, daily: [] } });
    const view = await screenFor(locale);
    expect(view.getByText(message)).toBeTruthy();
  });

  it('disables refresh and retry while fetching without duplicate API requests', async () => {
    prepare({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: true,
      error: new Error('SECRET'),
    });
    const view = await screenFor('en');
    expect(
      view.getByTestId('progress-refresh').props.accessibilityState?.disabled ??
        view.getByTestId('progress-refresh').props.disabled,
    ).toBe(true);
    expect(view.getByText('Refreshing…')).toBeTruthy();
    await fireEvent.press(view.getByTestId('progress-refresh'));
    await fireEvent.press(view.getByTestId('progress-retry'));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('localizes loading accessibility and refresh CTA without changing query logic', async () => {
    prepare({ data: undefined, isPending: true });
    const view = await screenFor('en');
    expect(view.getByLabelText('Loading statistics')).toBeTruthy();
    expect(view.getByLabelText('Refresh progress')).toBeTruthy();
    await fireEvent.press(view.getByTestId('progress-refresh'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
