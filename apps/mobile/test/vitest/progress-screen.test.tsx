import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

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

function prepare(withError = false) {
  vi.mocked(useWorkoutSummary).mockReturnValue({
    data: withError
      ? undefined
      : {
          workoutCount: 1,
          activeDays: 1,
          completedSets: 3,
          strengthVolumeKg: 0,
          asOf: '2026-11-17T10:00:00.000Z',
          daily: [{ date: '2026-11-17', strengthVolumeKg: 0 }],
        },
    isPending: false,
    isError: withError,
    isFetching: false,
    error: withError ? new Error('Немає з’єднання') : null,
    refetch,
  } as unknown as ReturnType<typeof useWorkoutSummary>);
}

describe('Mobile ProgressScreen', () => {
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

  it('navigates to the selected exercise without replacing the workout summary', async () => {
    const view = await render(<ProgressScreen />);
    await fireEvent.press(view.getByTestId('workout-exercise-open'));
    await fireEvent.press(view.getByRole('button', { name: 'Жим лежачи' }));
    expect(push).toHaveBeenCalledExactlyOnceWith({
      pathname: '/progress/exercises/[id]',
      params: { id: 'exercise-1' },
    });
    expect(view.getByText('Тренувальний об’єм за днями')).toBeTruthy();
  });

  it('does not show a positive-volume chart for zero strength volume', async () => {
    const view = await render(<ProgressScreen />);
    expect(view.getByText('За цей період немає записаного силового об’єму.')).toBeTruthy();
    expect(view.getByText('Тренувальний об’єм за днями')).toBeTruthy();
  });

  it('uses a separate query for the selected period', async () => {
    const view = await render(<ProgressScreen />);
    expect(useWorkoutSummary).toHaveBeenCalledWith('30d');
    await fireEvent.press(view.getByTestId('progress-range-7d'));
    expect(useWorkoutSummary).toHaveBeenCalledWith('7d');
  });

  it('exposes a manual retry after a recoverable error', async () => {
    prepare(true);
    const view = await render(<ProgressScreen />);
    expect(view.getByText('Немає з’єднання')).toBeTruthy();
    await fireEvent.press(view.getByTestId('progress-retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
