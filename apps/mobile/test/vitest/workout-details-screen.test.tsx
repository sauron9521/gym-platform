import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import { WorkoutSetRow } from '@/screens/workouts/ui/workout-set-row';
import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

vi.mock('@/features/workouts/model/workout-details-query', () => ({
  useWorkoutDetailsQuery: vi.fn(),
  useWorkoutTransition: vi.fn(),
}));
vi.mock('@/screens/workouts/ui/workout-set-row', () => ({
  WorkoutSetRow: vi.fn(() => null),
}));
vi.mock('@/features/workouts/model/workout-edit', () => ({
  useCancelWorkout: vi.fn(),
  useUpdateWorkoutTitle: vi.fn(),
}));

const refetch = vi.fn();
const mutate = vi.fn();
const mutateTitle = vi.fn();
const mutateCancel = vi.fn();

function prepareWorkout(
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED',
  setStatus: 'PENDING' | 'COMPLETED' | 'SKIPPED' = 'COMPLETED',
) {
  vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
    data: {
      id: 'workout-123',
      title: 'Тренування A',
      status,
      notes: null,
      exercises:
        status === 'IN_PROGRESS'
          ? [
              {
                id: 'exercise-1',
                exerciseNameSnapshot: 'Bench press',
                sets: [{ id: 'set-1', status: setStatus }],
              },
            ]
          : [],
    },
    isPending: false,
    isError: false,
    canonicalReadVersion: 5,
    refetch,
    error: null,
  } as unknown as ReturnType<typeof useWorkoutDetailsQuery>);

  vi.mocked(useWorkoutTransition).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useWorkoutTransition>);

  vi.mocked(useUpdateWorkoutTitle).mockReturnValue({
    mutate: mutateTitle,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUpdateWorkoutTitle>);
  vi.mocked(useCancelWorkout).mockReturnValue({
    mutate: mutateCancel,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCancelWorkout>);
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
    expect(mutate).toHaveBeenCalledWith(
      'start',
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('disables premature completion while sets remain pending or only skipped', async () => {
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const action = view.getByTestId('workout-status-action');
    expect(action.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(action);
    expect(mutate).not.toHaveBeenCalled();
    expect(view.getByText(/Для завершення потрібен/)).toBeTruthy();
  });

  it('shows a read-only checking state and blocks completion while refreshing canonical sets', async () => {
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...vi.mocked(useWorkoutDetailsQuery)('workout-123'),
      isFetching: true,
      isPending: false,
      isError: false,
    } as ReturnType<typeof useWorkoutDetailsQuery>);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('workout-reconciling')).toBeTruthy();
    const action = view.getByTestId('workout-status-action');
    expect(action.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(action);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('does not display cached completed sets after a failed canonical revalidation', async () => {
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...vi.mocked(useWorkoutDetailsQuery)('workout-123'),
      isFetching: false,
      isError: true,
      error: new Error('Не вдалося перевірити стан підходів.'),
    } as ReturnType<typeof useWorkoutDetailsQuery>);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByText('Не вдалося перевірити стан підходів.')).toBeTruthy();
    expect(view.queryByTestId('workout-status-action')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('keeps completion disabled when all sets are skipped', async () => {
    prepareWorkout('IN_PROGRESS', 'SKIPPED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByText(/0 виконано, 1 пропущено, 0 очікують/)).toBeTruthy();
    const action = view.getByTestId('workout-status-action');
    expect(action.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(action);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('ignores rapid duplicate completion presses before mutation settles', async () => {
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByText(/1 виконано, 0 пропущено, 0 очікують/)).toBeTruthy();
    const action = view.getByTestId('workout-status-action');
    await fireEvent.press(action);
    await fireEvent.press(action);
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('blocks workout actions and other sets until the pending write settles and a newer canonical GET verifies uncertainty', async () => {
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('workout-set-progress').props.accessibilityValue.now).toBe(100);
    const row = () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0];

    await act(async () => {
      expect(row().onWriteStart?.('set-1')).toBe(true);
      expect(row().onWriteStart?.('another')).toBe(false);
    });
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('workout-cancel').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => row().onWriteSettled?.('set-1', 5));
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    expect(row().actionBlocked).toBe(true);
    await fireEvent.press(view.getByTestId('workout-verify-sets'));
    expect(refetch).toHaveBeenCalledOnce();

    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...vi.mocked(useWorkoutDetailsQuery)('workout-123'),
      canonicalReadVersion: 6,
    });
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('workout-write-blocked')).toBeNull();
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(false);
  });

  it('starts the rest timer on a new confirmed set event and leaves progress derived from server data', async () => {
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('workout-set-progress').props.accessibilityValue.now).toBe(0);
    expect(view.getByRole('button', { name: 'Старт' })).toBeTruthy();
    await act(async () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0].onNewCompletion?.());
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
    expect(view.getByTestId('workout-set-progress').props.accessibilityValue.now).toBe(0);
  });

  it('completes an active workout and hides actions for completed workouts', async () => {
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.getByText('Завершити тренування')).toBeTruthy();
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );

    prepareWorkout('COMPLETED');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('workout-status-action')).toBeNull();
  });
});

describe('WorkoutDetailsScreen editing and cancellation (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('edits only a planned workout and passes a trimmed title to the mutation', async () => {
    prepareWorkout('PLANNED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.getByRole('button', { name: 'Зберегти назву', disabled: true })).toBeTruthy();
    await fireEvent.changeText(view.getByTestId('workout-title-edit'), '  Нова назва  ');
    await fireEvent.press(view.getByRole('button', { name: 'Зберегти назву' }));
    expect(mutateTitle).toHaveBeenCalledWith(
      'Нова назва',
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('requires native confirmation, ignores duplicate cancellation presses', async () => {
    prepareWorkout('IN_PROGRESS');
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.queryByTestId('workout-title-edit')).toBeNull();
    await fireEvent.press(view.getByTestId('workout-cancel'));
    await fireEvent.press(view.getByTestId('workout-cancel'));
    expect(alert).toHaveBeenCalledOnce();
    expect(mutateCancel).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2];
    expect(buttons?.[1]?.style).toBe('destructive');
    buttons?.[1]?.onPress?.();
    expect(mutateCancel).toHaveBeenCalledOnce();
  });

  it('never offers editing or cancellation for completed workouts', async () => {
    prepareWorkout('COMPLETED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.queryByTestId('workout-title-edit')).toBeNull();
    expect(view.queryByTestId('workout-cancel')).toBeNull();
    expect(view.queryByTestId('workout-status-action')).toBeNull();
  });
});
