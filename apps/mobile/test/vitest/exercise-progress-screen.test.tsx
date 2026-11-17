import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExerciseProgress } from '@/features/progress/model/exercise-progress-query';
import { ExerciseProgressScreen } from '@/screens/progress/ui/exercise-progress-screen';

vi.mock('@/features/progress/model/exercise-progress-query', () => ({
  useExerciseProgress: vi.fn(),
}));

const refetch = vi.fn();
function prepare(overrides: Record<string, unknown> = {}) {
  vi.mocked(useExerciseProgress).mockReturnValue({
    data: {
      name: 'Жим лежачи',
      completedSets: 5,
      strengthReps: 40,
      strengthVolumeKg: 2100,
      bestWeightKg: 80,
      daily: [{ date: '2026-11-17', strengthVolumeKg: 2100 }],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useExerciseProgress>);
}

describe('ExerciseProgressScreen (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepare();
  });

  it('renders exercise-specific metrics and volume', async () => {
    const view = await render(<ExerciseProgressScreen id="exercise-1" />);
    expect(view.getByText('Жим лежачи')).toBeTruthy();
    expect(view.getByText('Найкраща вага: 80 кг')).toBeTruthy();
    expect(view.getByText('Об’єм: 2100 кг')).toBeTruthy();
    expect(useExerciseProgress).toHaveBeenCalledWith('exercise-1', '30d');
  });

  it('switches query ranges without changing exercise', async () => {
    const view = await render(<ExerciseProgressScreen id="exercise-1" />);
    await fireEvent.press(view.getByTestId('exercise-progress-range-7d'));
    expect(useExerciseProgress).toHaveBeenCalledWith('exercise-1', '7d');
  });

  it('offers a retry after API failure', async () => {
    prepare({ data: undefined, isError: true, error: new Error('Немає зв’язку') });
    const view = await render(<ExerciseProgressScreen id="exercise-1" />);
    expect(view.getByText('Немає зв’язку')).toBeTruthy();
    await fireEvent.press(view.getByTestId('exercise-progress-retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('rejects missing route identifiers without displaying a loading spinner', async () => {
    prepare({ data: undefined, isPending: true });
    const view = await render(<ExerciseProgressScreen id="" />);
    expect(view.getByText('Некоректний ідентифікатор вправи.')).toBeTruthy();
    expect(view.queryByLabelText('Завантаження прогресу вправи')).toBeNull();
  });
});
