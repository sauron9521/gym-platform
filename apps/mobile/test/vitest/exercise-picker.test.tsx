import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';

vi.mock('@/features/exercises/model/exercises-query', () => ({ useExercisesQuery: vi.fn() }));

const refetch = vi.fn();
const fetchNextPage = vi.fn();

function prepareQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useExercisesQuery).mockReturnValue({
    data: {
      pages: [
        {
          data: [
            { id: 'exercise-1', name: 'Жим лежачи', isArchived: false },
            { id: 'exercise-archived', name: 'Архівна вправа', isArchived: true },
          ],
        },
      ],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    refetch,
    fetchNextPage,
    ...overrides,
  } as unknown as ReturnType<typeof useExercisesQuery>);
}

describe('ExercisePicker (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareQuery();
  });

  it('selects a non-archived exercise without showing archived options', async () => {
    const onSelect = vi.fn();
    const view = await render(<ExercisePicker selectedId="" onSelect={onSelect} />);

    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.queryByText('Архівна вправа')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('exercise-1');
    expect(view.getByText('Обрати вправу')).toBeTruthy();
  });

  it('deduplicates exercises across pages and loads more only on demand', async () => {
    prepareQuery({
      data: {
        pages: [
          { data: [{ id: 'exercise-1', name: 'Жим лежачи', isArchived: false }] },
          {
            data: [
              { id: 'exercise-1', name: 'Жим лежачи', isArchived: false },
              { id: 'exercise-2', name: 'Присідання', isArchived: false },
            ],
          },
        ],
      },
      hasNextPage: true,
    });
    const view = await render(<ExercisePicker selectedId="exercise-1" onSelect={vi.fn()} />);

    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.getByRole('button', { name: 'Жим лежачи' })).toBeTruthy();
    expect(view.getByText('Присідання')).toBeTruthy();
    await fireEvent.press(view.getByTestId('workout-exercises-next'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it('keeps the pagination button disabled during a page fetch', async () => {
    prepareQuery({ hasNextPage: true, isFetching: true, isFetchingNextPage: true });
    const view = await render(<ExercisePicker selectedId="" onSelect={vi.fn()} />);

    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(
      view.getByRole('button', { name: 'Показати більше вправ', disabled: true }),
    ).toBeTruthy();
    expect(view.getByText('Завантаження…')).toBeTruthy();
  });

  it('offers an accessible retry instead of stale exercise choices on errors', async () => {
    prepareQuery({ isError: true, error: new Error('Мережева помилка') });
    const view = await render(<ExercisePicker selectedId="" onSelect={vi.fn()} />);

    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.getByText('Мережева помилка')).toBeTruthy();
    expect(view.queryByText('Жим лежачи')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('debounces and trims API search requests', async () => {
    const view = await render(<ExercisePicker selectedId="" onSelect={vi.fn()} />);
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.changeText(view.getByTestId('workout-exercise-search'), '  жим  ');

    expect(vi.mocked(useExercisesQuery)).toHaveBeenLastCalledWith({ search: '' });
    await waitFor(() => {
      expect(vi.mocked(useExercisesQuery)).toHaveBeenLastCalledWith({ search: 'жим' });
    });
  });

  it('keeps the selected label tied to the externally controlled ID', async () => {
    const onSelect = vi.fn();
    const view = await render(<ExercisePicker selectedId="" onSelect={onSelect} />);
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));

    view.rerender(<ExercisePicker selectedId="exercise-1" onSelect={onSelect} />);
    expect(view.getByText('Жим лежачи')).toBeTruthy();

    // A form reset or external change must never display a different ID's cached name.
    view.rerender(<ExercisePicker selectedId="different-id" onSelect={onSelect} />);
    expect(view.getByText('Вправу обрано')).toBeTruthy();

    view.rerender(<ExercisePicker selectedId="" onSelect={onSelect} />);
    expect(view.getByText('Обрати вправу')).toBeTruthy();
  });

  it('clears search when cancelled and does not select an exercise', async () => {
    const onSelect = vi.fn();
    const view = await render(<ExercisePicker selectedId="" onSelect={onSelect} />);
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.changeText(view.getByTestId('workout-exercise-search'), '  присідання  ');
    await waitFor(() => {
      expect(vi.mocked(useExercisesQuery)).toHaveBeenLastCalledWith({ search: 'присідання' });
    });
    await fireEvent.press(view.getByTestId('workout-exercise-close'));
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.getByTestId('workout-exercise-search').props.value).toBe('');
    expect(vi.mocked(useExercisesQuery)).toHaveBeenLastCalledWith({ search: '' });
  });

  it('keeps cached exercises and offers retry on a failed next page', async () => {
    prepareQuery({
      isError: true,
      isFetchNextPageError: true,
      hasNextPage: true,
      error: new Error('Помилка наступної сторінки'),
    });
    const view = await render(<ExercisePicker selectedId="" onSelect={vi.fn()} />);
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.getByRole('button', { name: 'Жим лежачи' })).toBeTruthy();
    expect(view.getByText('Помилка сторінки. Спробувати ще')).toBeTruthy();
    await fireEvent.press(view.getByTestId('workout-exercises-next'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it('does not open the catalog when disabled', async () => {
    const view = await render(<ExercisePicker selectedId="" disabled onSelect={vi.fn()} />);
    expect(view.getByTestId('workout-exercise-open').props.accessibilityState).toEqual({
      disabled: true,
    });
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    expect(view.queryByTestId('workout-exercise-search')).toBeNull();
  });
});
