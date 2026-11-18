import { Alert, ScrollView } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react-native';

import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

vi.mock('@/features/workouts/model/workout-details-query', () => ({
  useWorkoutDetailsQuery: vi.fn(),
  useWorkoutTransition: vi.fn(),
}));
vi.mock('@/features/workouts/model/workout-edit', () => ({
  useCancelWorkout: vi.fn(),
  useUpdateWorkoutTitle: vi.fn(),
}));

const mutate = vi.fn();
const mutateTitle = vi.fn();
const mutateCancel = vi.fn();

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

  it('keeps workout details keyboard-aware and scrollable', async () => {
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const scroll = view.UNSAFE_getAllByType(ScrollView)[0];
    expect(scroll?.props.testID).toBe('workout-details-scroll');
    expect(scroll?.props).toMatchObject({
      contentInsetAdjustmentBehavior: 'automatic',
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
      alwaysBounceVertical: false,
    });
    expect(scroll?.props.contentContainerStyle).toMatchObject({ paddingBottom: 64 });
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
