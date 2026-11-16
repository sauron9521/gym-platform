import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

vi.mock('@/features/workouts/model/workout-details-query', () => ({
  useWorkoutDetailsQuery: vi.fn(),
  useWorkoutTransition: vi.fn(),
}));

const mutate = vi.fn();

function prepareWorkout(status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED') {
  vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
    data: {
      id: 'workout-123',
      title: 'Тренування A',
      status,
      notes: null,
      exercises: [],
    },
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWorkoutDetailsQuery>);

  vi.mocked(useWorkoutTransition).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useWorkoutTransition>);
}

describe('WorkoutDetailsScreen (real React Native renderer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a planned workout by pressing the native action button', async () => {
    prepareWorkout('PLANNED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.getByText('Тренування A')).toBeTruthy();
    expect(view.getByText('Почати тренування')).toBeTruthy();

    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith('start');
  });

  it('completes an active workout and hides actions for completed workouts', async () => {
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.getByText('Завершити тренування')).toBeTruthy();
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).toHaveBeenCalledWith('complete');

    prepareWorkout('COMPLETED');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('workout-status-action')).toBeNull();
  });
});
