import { IntlProvider } from 'react-intl';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  useWorkoutSetMutation,
  WorkoutSetOutcomeUnknownError,
} from '@/features/workouts/model/workout-set-mutation';
import { WorkoutSetRow } from '@/screens/workouts/ui/workout-set-row';

vi.mock('@/features/workouts/model/workout-set-mutation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/workouts/model/workout-set-mutation')>()),
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

  it('shows historical metrics separately and never replaces draft input or submits them', async () => {
    const hint = { setNumber: 1, setType: 'WORKING' as const, actualReps: 10, actualWeightKg: 0 };
    const row = (previousHint: typeof hint | undefined) => (
      <IntlProvider locale="en" messages={getMobileMessages('en')}>
        <WorkoutSetRow workoutId="workout-1" set={set} editable previousHint={previousHint} />
      </IntlProvider>
    );
    const view = await render(row(undefined));
    await fireEvent.changeText(view.getByTestId('set-weight-set-1'), '72.5');
    await fireEvent.changeText(view.getByTestId('set-reps-set-1'), '6');
    await view.rerender(row(hint));
    expect(view.getByText('Last time: 0 kg · 10 reps')).toBeTruthy();
    expect(view.getByTestId('set-weight-set-1').props.value).toBe('72.5');
    expect(view.getByTestId('set-reps-set-1').props.value).toBe('6');
    expect(mutateAsync).not.toHaveBeenCalled();
    await view.rerender(row(undefined));
    expect(view.queryByTestId('set-previous-set-1')).toBeNull();
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
        setId: 'set-1',
        body: { status: 'COMPLETED', actualReps: 6, actualWeightKg: 72.5 },
      }),
    );
  });

  it('shows partial history without fabricated zeroes and hides history on saved sets', async () => {
    const hint = {
      setNumber: 1,
      setType: 'WORKING' as const,
      actualReps: null,
      actualWeightKg: 62.5,
    };
    const row = (status: 'PENDING' | 'COMPLETED') => (
      <IntlProvider locale="uk" messages={getMobileMessages('uk')}>
        <WorkoutSetRow
          workoutId="workout-1"
          set={{ ...set, status }}
          editable
          previousHint={hint}
        />
      </IntlProvider>
    );
    const view = await render(row('PENDING'));
    expect(view.getByText('Минулого разу: 62,5 кг')).toBeTruthy();
    await view.rerender(row('COMPLETED'));
    expect(view.queryByTestId('set-previous-set-1')).toBeNull();
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

  it('shows saved state and requires explicit edit before resubmitting', async () => {
    const completedSet = {
      ...set,
      status: 'COMPLETED',
      actualReps: 8,
      actualWeightKg: '60',
    } as typeof set;
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={completedSet} editable />);
    expect(view.getByText('✓ Збережено')).toBeTruthy();
    expect(view.queryByTestId('set-complete-set-1')).toBeNull();
    await fireEvent.press(view.getByTestId('set-edit-set-1'));
    expect(view.getByTestId('set-complete-set-1')).toBeTruthy();
  });

  it('uses an acknowledged response while the parent still has a pending set snapshot', async () => {
    mutateAsync.mockResolvedValue({
      ...set,
      status: 'COMPLETED',
      actualReps: 8,
      actualWeightKg: '60',
    });

    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.press(view.getByTestId('set-complete-set-1'));

    await waitFor(() => expect(view.getByText('✓ Збережено')).toBeTruthy());
    expect(view.getByText('Результат: 8 повт. · 60 кг')).toBeTruthy();
    expect(view.queryByTestId('set-complete-set-1')).toBeNull();
    expect(view.queryByTestId('set-skip-set-1')).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps a server-confirmed skip from being submitted twice with stale parent data', async () => {
    mutateAsync.mockResolvedValue({
      ...set,
      status: 'SKIPPED',
    });

    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.press(view.getByTestId('set-skip-set-1'));

    await waitFor(() => expect(view.getByText('✓ Пропущено')).toBeTruthy());
    expect(view.queryByTestId('set-skip-set-1')).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('new canonical GET snapshot supersedes an older local completion receipt', async () => {
    mutateAsync.mockResolvedValue({
      ...set,
      status: 'COMPLETED',
      actualReps: 8,
      actualWeightKg: '60',
    });
    const view = await render(
      <WorkoutSetRow workoutId="workout-1" set={set} editable canonicalSnapshotAt={1} />,
    );
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(view.getByText('✓ Збережено')).toBeTruthy());

    // A new authoritative GET responds PENDING with the same updatedAt/revision.
    // Earlier local acknowledgement must not conceal this canonical response.
    await view.rerender(
      <WorkoutSetRow workoutId="workout-1" set={set} editable canonicalSnapshotAt={2} />,
    );
    await waitFor(() => expect(view.getByText('Очікує')).toBeTruthy());
    expect(view.queryByText('✓ Збережено')).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('disables edits and does not resend a PATCH during reconciliation', async () => {
    const view = await render(
      <WorkoutSetRow workoutId="workout-1" set={set} editable reconciling />,
    );
    expect(view.getByTestId('set-complete-set-1').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('set-skip-set-1').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await fireEvent.press(view.getByTestId('set-skip-set-1'));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('lost PATCH response blocks duplicate completion until canonical GET succeeds', async () => {
    const unknown = new WorkoutSetOutcomeUnknownError();
    unknown.readVersionAtFailure = 6;
    mutateAsync.mockRejectedValue(unknown);
    vi.mocked(useWorkoutSetMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: unknown,
    } as unknown as ReturnType<typeof useWorkoutSetMutation>);

    const view = await render(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalSnapshotAt={100}
        canonicalReadVersion={5}
      />,
    );
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(view.getByTestId('set-uncertain-set-1')).toBeTruthy());
    expect(view.getByTestId('set-complete-set-1').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await fireEvent.press(view.getByTestId('set-skip-set-1'));
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // A different set's successful PATCH could update the shared cache timestamp.
    // It must NOT unlock the uncertain row without a verified read.
    await view.rerender(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalSnapshotAt={101}
        canonicalReadVersion={5}
      />,
    );
    expect(view.getByTestId('set-uncertain-set-1')).toBeTruthy();
    expect(view.getByTestId('set-complete-set-1').props.accessibilityState.disabled).toBe(true);
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // A GET completed before the error was classified does not count.
    await view.rerender(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalSnapshotAt={102}
        canonicalReadVersion={6}
      />,
    );
    expect(view.getByTestId('set-uncertain-set-1')).toBeTruthy();
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // Only a GET verified after the outcome became unknown can unlock writes.
    await view.rerender(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalSnapshotAt={103}
        canonicalReadVersion={7}
      />,
    );
    expect(view.queryByTestId('set-uncertain-set-1')).toBeNull();
    expect(view.getByText('Очікує')).toBeTruthy();
    expect(view.getByTestId('set-complete-set-1').props.accessibilityState.disabled).toBe(false);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not lock if the lost response was already reconciled with an authoritative GET', async () => {
    const unknown = new WorkoutSetOutcomeUnknownError();
    unknown.canonicalStateVerified = true;
    mutateAsync.mockRejectedValue(unknown);
    vi.mocked(useWorkoutSetMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: unknown,
    } as unknown as ReturnType<typeof useWorkoutSetMutation>);
    const view = await render(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalSnapshotAt={101}
        canonicalReadVersion={6}
      />,
    );
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(view.getByText(/Стан отримано із сервера/)).toBeTruthy());
    expect(view.queryByTestId('set-uncertain-set-1')).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
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
    await act(async () => finish({ id: 'set-1' }));
  });
  it.each(['complete', 'skip'] as const)(
    'shows immediate pending feedback and disables both actions during %s',
    async (action) => {
      let finish: (value: typeof set) => void = () => undefined;
      mutateAsync.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
      await fireEvent.press(view.getByTestId(`set-${action}-set-1`));
      await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
      expect(view.getByTestId('set-status-set-1').props.children).toBe('Зберігаємо…');
      expect(view.getByTestId('set-reps-set-1').props.editable).toBe(false);
      expect(view.getByTestId('set-weight-set-1').props.editable).toBe(false);
      expect(view.getByTestId('set-complete-set-1').props.accessibilityState.disabled).toBe(true);
      expect(view.getByTestId('set-skip-set-1').props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(view.getByTestId('set-complete-set-1'));
      await fireEvent.press(view.getByTestId('set-skip-set-1'));
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      await act(async () =>
        finish({ ...set, status: action === 'complete' ? 'COMPLETED' : 'SKIPPED' }),
      );
      await waitFor(() =>
        expect(view.getByText(action === 'complete' ? '✓ Збережено' : '✓ Пропущено')).toBeTruthy(),
      );
    },
  );

  it('releases the local lock after invalid input without sending a write', async () => {
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={set} editable />);
    await fireEvent.changeText(view.getByTestId('set-reps-set-1'), '0');
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(view.getByTestId('set-reps-set-1').props.editable).toBe(true));
    expect(mutateAsync).not.toHaveBeenCalled();
    await fireEvent.changeText(view.getByTestId('set-reps-set-1'), '8');
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });
  it('emits rest only for a newly confirmed completion, not skip or an edited completed set', async () => {
    const onNewCompletion = vi.fn();
    const onWriteStart = vi.fn(() => true);
    const onWriteSettled = vi.fn();
    mutateAsync.mockResolvedValueOnce({ ...set, status: 'COMPLETED' });
    const view = await render(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        onNewCompletion={onNewCompletion}
        onWriteStart={onWriteStart}
        onWriteSettled={onWriteSettled}
      />,
    );
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(onWriteSettled).toHaveBeenCalledWith(set.id, null));
    expect(onNewCompletion).toHaveBeenCalledOnce();
    await fireEvent.press(view.getByTestId('set-edit-set-1'));
    mutateAsync.mockResolvedValueOnce({ ...set, status: 'COMPLETED' });
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(onWriteSettled).toHaveBeenCalledTimes(2));
    expect(onNewCompletion).toHaveBeenCalledOnce();
    await view.unmount();
    const skipped = await render(
      <WorkoutSetRow workoutId="workout-1" set={set} editable onNewCompletion={onNewCompletion} />,
    );
    mutateAsync.mockResolvedValueOnce({ ...set, status: 'SKIPPED' });
    await fireEvent.press(skipped.getByTestId('set-skip-set-1'));
    await waitFor(() => expect(skipped.getByText('✓ Пропущено')).toBeTruthy());
    expect(onNewCompletion).toHaveBeenCalledOnce();
  });

  it('reports a required canonical read after an ambiguous write and never starts rest', async () => {
    const unknown = new WorkoutSetOutcomeUnknownError();
    unknown.readVersionAtFailure = 6;
    mutateAsync.mockRejectedValueOnce(unknown);
    const onWriteSettled = vi.fn();
    const onNewCompletion = vi.fn();
    const view = await render(
      <WorkoutSetRow
        workoutId="workout-1"
        set={set}
        editable
        canonicalReadVersion={5}
        onWriteStart={() => true}
        onWriteSettled={onWriteSettled}
        onNewCompletion={onNewCompletion}
      />,
    );
    await fireEvent.press(view.getByTestId('set-complete-set-1'));
    await waitFor(() => expect(onWriteSettled).toHaveBeenCalledWith(set.id, 6));
    expect(onNewCompletion).not.toHaveBeenCalled();
  });
  it('cancels editing without a write and restores the acknowledged values on reopening', async () => {
    const completed = {
      ...set,
      status: 'COMPLETED',
      actualReps: 8,
      actualWeightKg: '60',
    } as typeof set;
    const view = await render(<WorkoutSetRow workoutId="workout-1" set={completed} editable />);
    await fireEvent.press(view.getByTestId('set-edit-set-1'));
    await fireEvent.changeText(view.getByTestId('set-reps-set-1'), '12');
    await fireEvent.changeText(view.getByTestId('set-weight-set-1'), '75');
    await fireEvent.press(view.getByTestId('set-edit-cancel-set-1'));
    expect(view.getByText('Результат: 8 повт. · 60 кг')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('set-edit-set-1'));
    expect(view.getByTestId('set-reps-set-1').props.value).toBe('8');
    expect(view.getByTestId('set-weight-set-1').props.value).toBe('60');
  });
});
