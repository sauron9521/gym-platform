import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useWorkoutSetMutation } from '@/features/workouts/model/workout-set-mutation';
import { WorkoutSetRow } from '@/screens/workouts/ui/workout-set-row';

vi.mock('@/features/workouts/model/workout-set-mutation', () => ({
  useWorkoutSetMutation: vi.fn(),
}));

const mutateAsync = vi.fn();

const set = {
  id: 'set-1',
  setNumber: 1,
  status: 'PENDING',
  plannedReps: 8,
  plannedWeightKg: '60',
  actualReps: null,
  actualWeightKg: null,
} as unknown as Parameters<typeof WorkoutSetRow>[0]['set'];

describe('WorkoutSetRow (React Native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ id: 'set-1', status: 'COMPLETED' });
    vi.mocked(useWorkoutSetMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useWorkoutSetMutation>);
  });

  it('validates input and submits actual reps with a decimal comma weight', async () => {
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.changeText(view.getByTestId('set-reps-set-1'), '6');
    await fireEvent.changeText(view.getByTestId('set-weight-set-1'), '72,5');
    await fireEvent.press(view.getByTestId('set-complete-set-1'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        setId: 'set-1',
        body: { status: 'COMPLETED', actualReps: 6, actualWeightKg: 72.5 },
      }),
    );
  });

  it('skips a set without submitting performance values', async () => {
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.press(view.getByTestId('set-skip-set-1'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        setId: 'set-1',
        body: { status: 'SKIPPED' },
      }),
    );
  });

  it('does not send mutations when the workout is not active', async () => {
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable={false} />);
    expect(view.queryByTestId('set-complete-set-1')).toBeNull();
    expect(view.queryByTestId('set-skip-set-1')).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows a saved state and hides repeated completion until edit is explicitly requested', async () => {
    const completedSet = { ...set, status: 'COMPLETED', actualReps: 8, actualWeightKg: '60' } as typeof set;
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={completedSet} editable />);
    expect(view.getByText('✓ Збережено')).toBeTruthy();
    expect(view.queryByTestId('set-complete-set-1')).toBeNull();
    await fireEvent.press(view.getByTestId('set-edit-set-1'));
    expect(view.getByTestId('set-complete-set-1')).toBeTruthy();
  });

  it('rejects a second immediate completion while the first request is pending', async () => {
    let finish!: (value: { id: string }) => void;
    mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await fireEvent.press(view.getByTestId('set-complete-set-1'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    finish({ id: 'set-1' });
  });
});
