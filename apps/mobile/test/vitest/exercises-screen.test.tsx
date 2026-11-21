import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { getFlatMessages, type Locale } from '@gym/i18n';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExerciseFilters, useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { ExercisesScreen } from '@/screens/exercises/ui/exercises-screen';

vi.mock('@/features/exercises/model/exercises-query', () => ({
  useExerciseFilters: vi.fn(),
  useExercisesQuery: vi.fn(),
}));

const fetchNextPage = vi.fn();
const refetch = vi.fn();
const muscleRefetch = vi.fn();
const equipmentRefetch = vi.fn();
const exercise = {
  id: 'exercise-1',
  name: 'Жим лежачи',
  description: 'Авторський опис вправи',
  exerciseType: 'STRENGTH',
  muscleGroups: [{ muscleGroup: { name: 'Груди' } }],
};

function prepare(
  options: {
    pageError?: boolean;
    query?: Record<string, unknown>;
    muscle?: Record<string, unknown>;
    equipment?: Record<string, unknown>;
  } = {},
) {
  vi.mocked(useExerciseFilters).mockReturnValue({
    muscleGroups: {
      data: [{ id: 'mg-1', slug: 'chest', name: 'Груди' }],
      isFetching: false,
      isError: false,
      error: null,
      refetch: muscleRefetch,
      ...options.muscle,
    },
    equipment: {
      data: [{ id: 'eq-1', slug: 'barbell', name: 'Штанга' }],
      isFetching: false,
      isError: false,
      error: null,
      refetch: equipmentRefetch,
      ...options.equipment,
    },
  } as unknown as ReturnType<typeof useExerciseFilters>);
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: { pages: [{ data: [exercise] }, { data: [exercise] }] },
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: options.pageError ?? false,
    hasNextPage: options.pageError ?? false,
    fetchNextPage,
    refetch,
    ...options.query,
  } as unknown as ReturnType<typeof useExercisesQuery>);
}

function screenFor(locale: Locale) {
  return render(
    <IntlProvider locale={locale} defaultLocale="uk" messages={getFlatMessages(locale)}>
      <ExercisesScreen />
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  refetch.mockResolvedValue(undefined);
  fetchNextPage.mockResolvedValue(undefined);
  muscleRefetch.mockResolvedValue(undefined);
  equipmentRefetch.mockResolvedValue(undefined);
  prepare();
});
afterEach(async () => {
  await cleanup();
});

describe('Native exercise catalog and uk/en localization', () => {
  it('renders deduplicated exercises and preserves API content in Ukrainian', async () => {
    const view = await screenFor('uk');
    expect(view.getByText('Каталог вправ')).toBeTruthy();
    expect(view.getAllByText('Жим лежачи')).toHaveLength(1);
    expect(view.getByText('Авторський опис вправи')).toBeTruthy();
    expect(view.getByText('Силова')).toBeTruthy();
    expect(view.getAllByText('Груди').length).toBeGreaterThan(0);
    expect(view.getByText('Штанга')).toBeTruthy();
    expect(view.getByLabelText('Пошук вправ')).toBeTruthy();
    expect(view.getByLabelText('Оновити каталог вправ')).toBeTruthy();
  });

  it('localizes English headers, filters, refresh and exercise type without rewriting user data', async () => {
    const view = await screenFor('en');
    expect(view.getByText('Exercise catalog')).toBeTruthy();
    expect(view.getByLabelText('Search exercises')).toBeTruthy();
    expect(view.getByText('Muscle group')).toBeTruthy();
    expect(view.getByText('Equipment')).toBeTruthy();
    expect(view.getByText('Strength')).toBeTruthy();
    expect(view.getByText('Жим лежачи')).toBeTruthy();
    expect(view.getByText('Авторський опис вправи')).toBeTruthy();
    expect(view.getByText('Штанга')).toBeTruthy();
    expect(view.getByLabelText('Refresh exercise catalog')).toBeTruthy();
    expect(view.getByTestId('exercise-search').props.placeholder).toBe('Exercise name');
    expect(view.getByTestId('exercise-muscles-all').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('exercise-equipment-all').props.accessibilityState.selected).toBe(true);
  });

  it('keeps current muscle and equipment filters and original API filter query on a language change', async () => {
    const view = await screenFor('en');
    await fireEvent.press(view.getByTestId('exercise-muscle-chest'));
    expect(useExercisesQuery).toHaveBeenCalledWith({
      search: '',
      muscleGroup: 'chest',
      equipment: undefined,
    });
    await fireEvent.press(view.getByTestId('exercise-equipment-barbell'));
    expect(useExercisesQuery).toHaveBeenCalledWith({
      search: '',
      muscleGroup: 'chest',
      equipment: 'barbell',
    });
    await view.rerender(
      <IntlProvider locale="uk" defaultLocale="uk" messages={getFlatMessages('uk')}>
        <ExercisesScreen />
      </IntlProvider>,
    );
    expect(view.getByText('Каталог вправ')).toBeTruthy();
    expect(view.getByTestId('exercise-muscle-chest').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('exercise-equipment-barbell').props.accessibilityState.selected).toBe(
      true,
    );
    expect(useExercisesQuery).toHaveBeenCalledWith({
      search: '',
      muscleGroup: 'chest',
      equipment: 'barbell',
    });
  });

  it('clears each taxonomy filter independently without replacing the search term', async () => {
    const view = await screenFor('en');
    await fireEvent.press(view.getByTestId('exercise-muscle-chest'));
    await fireEvent.press(view.getByTestId('exercise-equipment-barbell'));
    await fireEvent.press(view.getByTestId('exercise-muscles-all'));
    expect(useExercisesQuery).toHaveBeenCalledWith({
      search: '',
      muscleGroup: undefined,
      equipment: 'barbell',
    });
    await fireEvent.press(view.getByTestId('exercise-equipment-all'));
    expect(useExercisesQuery).toHaveBeenCalledWith({
      search: '',
      muscleGroup: undefined,
      equipment: undefined,
    });
  });

  it('shows an explicit localized pagination retry without triggering infinite-scroll retries', async () => {
    prepare({ pageError: true });
    const view = await screenFor('en');
    expect(view.getByText('Failed to load page. Retry')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('exercises-load-more'));
    expect(fetchNextPage).toHaveBeenCalledExactlyOnceWith();
    expect(view.getByText('Жим лежачи')).toBeTruthy();
  });

  it('blocks repeated pagination and refresh requests while fetching', async () => {
    prepare({
      pageError: true,
      query: { isFetching: true, isFetchingNextPage: true },
    });
    const view = await screenFor('en');
    expect(view.getByText('Loading more exercises…')).toBeTruthy();
    expect(view.getByText('Refreshing…')).toBeTruthy();
    expect(view.getByTestId('exercises-refresh').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('exercises-refresh'));
    expect(refetch).not.toHaveBeenCalled();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('uses a localized refresh action and calls the original request once', async () => {
    const view = await screenFor('en');
    await fireEvent.press(view.getByTestId('exercises-refresh'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each([
    { locale: 'uk' as const, empty: 'За такими фільтрами вправ немає.' },
    { locale: 'en' as const, empty: 'No exercises match these filters.' },
  ])('shows empty state in $locale', async ({ locale, empty }) => {
    prepare({ query: { data: { pages: [{ data: [] }] }, hasNextPage: false } });
    const view = await screenFor(locale);
    expect(view.getByText(empty)).toBeTruthy();
    expect(view.queryByTestId('exercises-load-more')).toBeNull();
  });

  it('uses English errors and retries without rendering raw backend error bodies', async () => {
    prepare({
      query: { data: undefined, isError: true, error: new Error('SECRET_EXERCISE_RESPONSE') },
      muscle: { isError: true, error: new Error('SECRET_MUSCLE_RESPONSE') },
      equipment: { isError: true, error: new Error('SECRET_EQUIPMENT_RESPONSE') },
    });
    const view = await screenFor('en');
    expect(view.getByText('Could not load exercises. Try again.')).toBeTruthy();
    expect(view.getByText('Could not load muscle groups. Try again.')).toBeTruthy();
    expect(view.getByText('Could not load equipment. Try again.')).toBeTruthy();
    expect(view.queryByText(/SECRET_/)).toBeNull();

    await fireEvent.press(view.getByTestId('exercises-retry'));
    await fireEvent.press(view.getByRole('button', { name: 'Retry muscle groups' }));
    await fireEvent.press(view.getByRole('button', { name: 'Retry equipment' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(muscleRefetch).toHaveBeenCalledOnce();
    expect(equipmentRefetch).toHaveBeenCalledOnce();
  });

  it('prevents repeated taxonomy retries while those requests are pending', async () => {
    prepare({
      muscle: { isError: true, error: new Error('secret'), isFetching: true },
      equipment: { isError: true, error: new Error('secret'), isFetching: true },
    });
    const view = await screenFor('en');
    await fireEvent.press(view.getByRole('button', { name: 'Retry muscle groups' }));
    await fireEvent.press(view.getByRole('button', { name: 'Retry equipment' }));
    expect(muscleRefetch).not.toHaveBeenCalled();
    expect(equipmentRefetch).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'STRENGTH', label: 'Strength' },
    { type: 'CARDIO', label: 'Cardio' },
    { type: 'MOBILITY', label: 'Mobility' },
    { type: 'PLYOMETRIC', label: 'Plyometric' },
    { type: 'OTHER', label: 'Other' },
    { type: 'UNKNOWN_INTERNAL', label: 'Unknown exercise type' },
  ])('displays $type as a safe translated type label', async ({ type, label }) => {
    prepare({
      query: { data: { pages: [{ data: [{ ...exercise, exerciseType: type }] }] } },
    });
    const view = await screenFor('en');
    expect(view.getByText(label)).toBeTruthy();
    expect(view.queryByText(type)).toBeNull();
  });
});
