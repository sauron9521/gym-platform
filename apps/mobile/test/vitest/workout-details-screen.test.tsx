import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render as nativeRender } from '@testing-library/react-native';
import { useEffect, type PropsWithChildren } from 'react';
import { RestTimerProvider } from '@/features/workouts/model/rest-timer-provider';
import { Alert } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';

import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import { usePreviousSetHints } from '@/features/workouts/model/previous-set-hints-query';
import { WorkoutSetRow } from '@/screens/workouts/ui/workout-set-row';
import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
}));

function Wrapper({ children }: PropsWithChildren) {
  return (
    <RestTimerProvider
      accountId="athlete-a"
      defaultDuration={120}
      feedback={{ sound: true, vibration: true }}
    >
      <IntlProvider locale="uk" messages={getMobileMessages('uk')}>
        {children}
      </IntlProvider>
    </RestTimerProvider>
  );
}
const render = (element: React.ReactElement) => nativeRender(element, { wrapper: Wrapper });

vi.mock('@/features/workouts/model/workout-details-query', () => ({
  useWorkoutDetailsQuery: vi.fn(),
  useWorkoutTransition: vi.fn(),
}));
vi.mock('@/features/workouts/model/previous-set-hints-query', () => ({
  usePreviousSetHints: vi.fn(() => new Map()),
}));
vi.mock('@/screens/workouts/ui/workout-set-row', () => ({
  WorkoutSetRow: vi.fn(() => null),
}));
vi.mock('@/features/workouts/model/workout-edit', () => ({
  useCancelWorkout: vi.fn(),
  useUpdateWorkoutTitle: vi.fn(),
}));

const keepAwake = vi.hoisted(() => vi.fn());
vi.mock('@/features/workouts/lib/use-workout-keep-awake', () => ({
  useWorkoutKeepAwake: keepAwake,
}));

const notify = vi.hoisted(() => vi.fn());
vi.mock('@/features/workouts/lib/use-rest-feedback', () => ({ useRestFeedback: () => notify }));

const collapsePreference = vi.hoisted(() => ({ enabled: false }));
const confirmationPreference = vi.hoisted(() => ({ enabled: false }));
const shouldAutoStartRestTimer = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/features/app-settings/model/app-settings-context', () => ({
  useAppSettings: (select: (state: unknown) => unknown) =>
    select({
      shouldAutoStartRestTimer,
      settings: {
        accountId: 'athlete-a',
        restDuration: 120,
        restSound: true,
        restVibration: true,
        keepWorkoutScreenAwake: true,
        autoCollapseExercises: collapsePreference.enabled,
        confirmWorkoutCompletion: confirmationPreference.enabled,
      },
    }),
}));

const refetch = vi.fn();
const currentSnapshot = vi.fn(() => true);
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
      athleteId: 'athlete-a',
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
    dataUpdatedAt: 100,
    captureCompletionGuard: () => currentSnapshot,
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

beforeEach(() => {
  confirmationPreference.enabled = false;
  currentSnapshot.mockReset().mockReturnValue(true);
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});
afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

describe('WorkoutDetailsScreen (real React Native renderer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePreviousSetHints).mockReturnValue(new Map());
    collapsePreference.enabled = false;
  });

  it('shows a review by preference, permits cancellation and submits only once after explicit confirmation', async () => {
    confirmationPreference.enabled = true;
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(view.getByTestId('workout-completion-review')).toBeTruthy();
    expect(view.getByText(/1 виконано · 0 пропущено/)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('workout-cancel-completion'));
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('workout-status-action'));
    await fireEvent.press(view.getByTestId('workout-confirm-completion'));
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).toHaveBeenCalledExactlyOnceWith(
      'complete',
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it('invalidates review on a newer canonical snapshot and rejects stale cache consent', async () => {
    confirmationPreference.enabled = true;
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...vi.mocked(useWorkoutDetailsQuery)('workout-123'),
      canonicalReadVersion: 6,
    });
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
    await fireEvent.press(view.getByTestId('workout-status-action'));
    currentSnapshot.mockReturnValue(false);
    await fireEvent.press(view.getByTestId('workout-confirm-completion'));
    expect(mutate).not.toHaveBeenCalled();
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
  });

  it('invalidates review on background and network loss, without automatic submission', async () => {
    confirmationPreference.enabled = true;
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(view.getByTestId('workout-completion-review')).toBeTruthy();
    await act(async () => focusManager.setFocused(false));
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
    await act(async () => focusManager.setFocused(true));
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(view.getByTestId('workout-completion-review')).toBeTruthy();
    await act(async () => onlineManager.setOnline(false));
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await act(async () => onlineManager.setOnline(true));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('blocks finishing with an open saved-set editor regardless of confirmation preference', async () => {
    prepareWorkout('IN_PROGRESS');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const row = () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0];
    await act(async () => {
      expect(row().onEditStart?.('set-1')).toBe(true);
    });
    expect(view.getByTestId('workout-edit-blocked')).toBeTruthy();
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).not.toHaveBeenCalled();
    confirmationPreference.enabled = true;
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await act(async () => row().onEditEnd?.('set-1'));
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(view.getByTestId('workout-completion-review')).toBeTruthy();
    await act(async () => {
      expect(row().onEditStart?.('set-1')).toBe(true);
    });
    expect(view.queryByTestId('workout-completion-review')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('does not bypass cache validation even with confirmation disabled', async () => {
    prepareWorkout('IN_PROGRESS');
    currentSnapshot.mockReturnValue(false);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('passes only matching strength history to pending rows', async () => {
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const snapshot = vi.mocked(useWorkoutDetailsQuery)('workout-123');
    if (!snapshot.data) throw new Error('Missing fixture workout');
    const workout = snapshot.data;
    const source = workout.exercises[0]!;
    const exerciseId = '11111111-1111-4111-8111-111111111111';
    const hint = { setNumber: 1, setType: 'WORKING' as const, actualReps: 8, actualWeightKg: 60 };
    const pending = { ...source.sets[0]!, setNumber: 1, setType: 'WORKING' as const };
    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...snapshot,
      data: {
        ...workout,
        exercises: [
          {
            ...source,
            exerciseId,
            exerciseTypeSnapshot: 'STRENGTH',
            sets: [
              pending,
              { ...pending, id: 'warmup', setType: 'WARMUP' },
              { ...pending, id: 'saved', status: 'COMPLETED' },
            ],
          },
          {
            ...source,
            id: 'cardio-exercise',
            exerciseId,
            exerciseTypeSnapshot: 'CARDIO',
            sets: [{ ...pending, id: 'cardio-set' }],
          },
        ],
      },
    });
    vi.mocked(usePreviousSetHints).mockReturnValue(
      new Map([
        [
          exerciseId,
          {
            exerciseId,
            workoutCompletedAt: '2026-11-24T12:00:00.000Z',
            sets: [hint],
          },
        ],
      ]),
    );
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const row = (id: string) =>
      vi
        .mocked(WorkoutSetRow)
        .mock.calls.filter(([props]) => props.set.id === id)
        .at(-1)?.[0];
    expect(row('set-1')?.previousHint).toEqual(hint);
    for (const id of ['warmup', 'saved', 'cardio-set'])
      expect(row(id)?.previousHint).toBeUndefined();
    vi.mocked(usePreviousSetHints).mockReturnValue(new Map());
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(row('set-1')?.previousHint).toBeUndefined();
  });

  it('collapses only after the final set write settles and preserves manual expansion', async () => {
    collapsePreference.enabled = true;
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('exercise-toggle-exercise-1')).toBeNull();
    const row = () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0];
    await act(async () => {
      expect(row().onWriteStart?.('set-1')).toBe(true);
    });
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    const toggle = () => view.getByTestId('exercise-toggle-exercise-1');
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    await act(async () => row().onWriteSettled?.('set-1', null));
    expect(toggle().props.accessibilityState.expanded).toBe(false);
    expect(view.getByText('1 виконано · 0 пропущено / 1')).toBeTruthy();
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    collapsePreference.enabled = false;
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.queryByTestId('exercise-toggle-exercise-1')).toBeNull();
    expect(view.getByTestId('exercise-sets-exercise-1').props.accessibilityElementsHidden).toBe(
      false,
    );
  });

  it('waits for canonical verification after ambiguous final set write', async () => {
    collapsePreference.enabled = true;
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const row = () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0];
    await act(async () => {
      expect(row().onWriteStart?.('set-1')).toBe(true);
    });
    await act(async () => row().onWriteSettled?.('set-1', 5));
    prepareWorkout('IN_PROGRESS', 'COMPLETED');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('exercise-toggle-exercise-1').props.accessibilityState.expanded).toBe(
      true,
    );
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    vi.mocked(useWorkoutDetailsQuery).mockReturnValue({
      ...vi.mocked(useWorkoutDetailsQuery)('workout-123'),
      canonicalReadVersion: 6,
    });
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('exercise-toggle-exercise-1').props.accessibilityState.expanded).toBe(
      false,
    );
  });

  it('collapses all-skipped exercise without unlocking workout completion', async () => {
    collapsePreference.enabled = true;
    prepareWorkout('IN_PROGRESS', 'SKIPPED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(view.getByTestId('exercise-toggle-exercise-1').props.accessibilityState.expanded).toBe(
      false,
    );
    expect(view.getByText('0 виконано · 1 пропущено / 1')).toBeTruthy();
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('requests keep-awake only for an in-progress workout with valid details', async () => {
    prepareWorkout('PLANNED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    expect(keepAwake).toHaveBeenLastCalledWith(false);
    prepareWorkout('IN_PROGRESS');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(keepAwake).toHaveBeenLastCalledWith(true);
    prepareWorkout('COMPLETED');
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    expect(keepAwake).toHaveBeenLastCalledWith(false);
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
    expect(view.getByText('02:00')).toBeTruthy();
    await act(async () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0].onNewCompletion?.());
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
    expect(view.getByTestId('workout-set-progress').props.accessibilityValue.now).toBe(0);
  });

  it('keeps the timer when the details screen unmounts and returns to the same workout', async () => {
    prepareWorkout('IN_PROGRESS');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    await view.rerender(<></>);
    clock.mockReturnValue(110000);
    await view.rerender(<WorkoutDetailsScreen id="workout-123" />);
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('01:50')).toBeTruthy();
    clock.mockRestore();
  });

  it('does not auto-start when disabled and keeps the manual timer available', async () => {
    shouldAutoStartRestTimer.mockReturnValueOnce(false);
    prepareWorkout('IN_PROGRESS', 'PENDING');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    await act(async () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0].onNewCompletion?.());
    expect(view.getByRole('button', { name: 'Старт' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
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

  it('releases the action lock when cancellation is dismissed and keeps set writes blocked during transitions', async () => {
    prepareWorkout('IN_PROGRESS');
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);
    const row = () => vi.mocked(WorkoutSetRow).mock.calls.at(-1)![0];
    await fireEvent.press(view.getByTestId('workout-cancel'));
    expect(row().actionBlocked).toBe(true);
    expect(row().onWriteStart?.('set-1')).toBe(false);
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await act(async () => alert.mock.calls[0]?.[2]?.[0]?.onPress?.());
    expect(mutateCancel).not.toHaveBeenCalled();
    expect(row().actionBlocked).toBe(false);
    await fireEvent.press(view.getByTestId('workout-status-action'));
    expect(mutate).toHaveBeenCalledOnce();
    expect(row().onWriteStart?.('set-1')).toBe(false);
    await act(async () => mutate.mock.calls[0]?.[1]?.onSettled?.());
    expect(row().actionBlocked).toBe(false);
    await act(async () => {
      expect(row().onWriteStart?.('set-1')).toBe(true);
    });
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(true);
    await act(async () => row().onWriteSettled?.('set-1', null));
    expect(view.getByTestId('workout-status-action').props.accessibilityState.disabled).toBe(false);
  });

  it('never offers editing or cancellation for completed workouts', async () => {
    prepareWorkout('COMPLETED');
    const view = await render(<WorkoutDetailsScreen id="workout-123" />);

    expect(view.queryByTestId('workout-title-edit')).toBeNull();
    expect(view.queryByTestId('workout-cancel')).toBeNull();
    expect(view.queryByTestId('workout-status-action')).toBeNull();
  });
});
