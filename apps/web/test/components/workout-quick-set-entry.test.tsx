import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { WorkoutSetData } from '@/features/workouts/lib/workout-set-form';
import { getWorkoutSetPlanSuggestion } from '@/features/workouts/lib/workout-set-form';

const { useMutationMock, successMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  successMock: vi.fn(),
}));

vi.mock('@/features/workouts/api/workout-set-mutation', () => ({
  useUpdateWorkoutSetMutation: useMutationMock,
}));
vi.mock('sonner', () => ({ toast: { success: successMock } }));

import { WorkoutSetForm } from '@/features/workouts/ui/workout-set-form';

const set = {
  id: 'set-1',
  status: 'PENDING',
  plannedReps: 8,
  plannedWeightKg: '60.50',
  actualReps: null,
  actualWeightKg: null,
  actualDurationSeconds: null,
  actualDistanceMeters: null,
  restSeconds: null,
  rpe: null,
  rir: null,
  notes: null,
} as unknown as WorkoutSetData;

const onSaved = vi.fn();
const onSavedAndNext = vi.fn();
const onClose = vi.fn();
const mutateAsync = vi.fn();
const reset = vi.fn();

function mount(current: WorkoutSetData = set, next = true) {
  return render(
    <WorkoutSetForm
      workoutId="workout-1"
      set={current}
      onSaved={onSaved}
      onSavedAndNext={next ? onSavedAndNext : undefined}
      onClose={onClose}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockReturnValue({
    mutateAsync,
    reset,
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
  });
});

afterEach(cleanup);

test('planned reps and weight are suggestions, never recorded as actuals without user action', () => {
  expect(getWorkoutSetPlanSuggestion(set)).toEqual({
    actualReps: '8',
    actualWeightKg: '60.50',
  });
  mount();
  const reps = screen.getByRole('textbox', { name: 'Повторення' }) as HTMLInputElement;
  const weight = screen.getByRole('textbox', { name: 'Вага (кг)' }) as HTMLInputElement;
  expect(reps.value).toBe('');
  expect(weight.value).toBe('');
  expect(reps.inputMode).toBe('numeric');
  expect(weight.inputMode).toBe('decimal');
  expect(reps.className).toContain('h-12');
  expect(screen.getByText('Додаткові показники та нотатки')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Підставити план' }));
  expect(reps.value).toBe('8');
  expect(weight.value).toBe('60.50');
});

test('save and next opens the next editor only after server confirmation and rejects rapid taps', async () => {
  let confirm!: () => void;
  mutateAsync.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Підставити план' }));
  const next = screen.getByRole('button', { name: 'Зберегти й наступний' });
  fireEvent.click(next);
  fireEvent.click(next);
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
  expect(onSavedAndNext).not.toHaveBeenCalled();
  expect(successMock).not.toHaveBeenCalled();

  confirm();
  await waitFor(() => expect(onSavedAndNext).toHaveBeenCalledOnce());
  expect(onSaved).not.toHaveBeenCalled();
  expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
    setId: 'set-1',
    body: { status: 'COMPLETED', actualReps: 8, actualWeightKg: 60.5 },
  });
  expect(successMock).toHaveBeenCalledWith('Результат підходу збережено.');
});

test('errors keep the current editor and do not advance to another set', async () => {
  mutateAsync.mockRejectedValue(new Error('Request failed'));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти й наступний' }));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
  expect(onSavedAndNext).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(successMock).not.toHaveBeenCalled();
  expect(screen.getByRole('form', { name: 'Запис результатів підходу' })).toBeTruthy();
});

test('additional recorded metrics are expanded by default and are not lost on quick save', async () => {
  mutateAsync.mockResolvedValue(undefined);
  const current = {
    ...set,
    rpe: '8.5',
    notes: 'Після вправи',
  } as WorkoutSetData;
  mount(current, false);
  expect((screen.getByText('Додаткові показники та нотатки').closest('details') as HTMLDetailsElement).open).toBe(true);
  expect(screen.queryByRole('button', { name: 'Зберегти й наступний' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Позначити виконаним' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(onSavedAndNext).not.toHaveBeenCalled();
  expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
    status: 'COMPLETED',
    rpe: 8.5,
    notes: 'Після вправи',
  });
});

test('skipping never advances and preserves existing status-only request semantics', async () => {
  mutateAsync.mockResolvedValue(undefined);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Пропустити підхід' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(onSavedAndNext).not.toHaveBeenCalled();
  expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
    setId: 'set-1',
    body: { status: 'SKIPPED' },
  });
});
