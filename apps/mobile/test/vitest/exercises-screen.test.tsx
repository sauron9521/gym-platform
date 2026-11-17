import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import { useExerciseFilters, useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { ExercisesScreen } from '@/screens/exercises/ui/exercises-screen';

vi.mock('@/features/exercises/model/exercises-query', () => ({
  useExerciseFilters: vi.fn(),
  useExercisesQuery: vi.fn(),
}));

const fetchNextPage = vi.fn();
const refetch = vi.fn();

function prepare(pageError = false) {
  vi.mocked(useExerciseFilters).mockReturnValue({
    muscleGroups: { data: [{ id: 'mg-1', slug: 'chest', name: 'Груди' }] },
    equipment: { data: [{ id: 'eq-1', slug: 'barbell', name: 'Штанга' }] },
  } as unknown as ReturnType<typeof useExerciseFilters>);
  const exercise = {
    id: 'exercise-1',
    name: 'Жим лежачи',
    description: null,
    exerciseType: 'STRENGTH',
    muscleGroups: [{ muscleGroup: { name: 'Груди' } }],
  };
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: { pages: [{ data: [exercise] }, { data: [exercise] }] },
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: pageError,
    hasNextPage: pageError,
    fetchNextPage,
    refetch,
  } as unknown as ReturnType<typeof useExercisesQuery>);
}

describe('Exercise catalog in React Native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchNextPage.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
    prepare();
  });

  it('renders unique exercises and applies muscle and equipment filters', async () => {
    const view = await render(<ExercisesScreen />);
    expect(view.getAllByText('Жим лежачи')).toHaveLength(1);

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
  });

  it('shows manual retry for a failed page without automatic retry', async () => {
    prepare(true);
    const view = await render(<ExercisesScreen />);
    expect(view.getByText('Помилка сторінки. Спробувати ще')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('exercises-load-more'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });
});
