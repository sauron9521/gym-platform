import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { WorkoutSetData } from '@/features/workouts/lib/workout-set-form';

const { useMutationMock, successMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  successMock: vi.fn(),
}));

vi.mock('@/features/workouts/api/workout-set-mutation', () => ({
  useUpdateWorkoutSetMutation: useMutationMock,
}));
vi.mock('sonner', () => ({ toast: { success: successMock } }));

import { WorkoutSetForm } from '@/features/workouts/ui/workout-set-form';

const savedSet = {
  id: 'set-1',
  status: 'PENDING',
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
const onClose = vi.fn();
const mutateAsync = vi.fn();
const reset = vi.fn();

function mount() {
  return render(
    <WorkoutSetForm workoutId="workout-1" set={savedSet} onSaved={onSaved} onClose={onClose} />,
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

test('only confirms after the server mutation resolves and rejects rapid duplicate submissions', async () => {
  let confirm!: () => void;
  mutateAsync.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  mount();

  fireEvent.change(screen.getByRole('textbox', { name: 'Повторення' }), {
    target: { value: '8' },
  });
  const submit = screen.getByRole('button', { name: 'Позначити виконаним' });
  fireEvent.click(submit);
  fireEvent.click(submit);
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  expect(successMock).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();

  confirm();
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(successMock).toHaveBeenCalledWith('Результат підходу збережено.');
  expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
    setId: 'set-1',
    body: { status: 'COMPLETED', actualReps: 8 },
  });
});

test('skipping a set sends one status-only payload and confirms only after success', async () => {
  mutateAsync.mockResolvedValue(undefined);
  mount();

  const skip = screen.getByRole('button', { name: 'Пропустити підхід' });
  fireEvent.click(skip);
  fireEvent.click(skip);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
    setId: 'set-1',
    body: { status: 'SKIPPED' },
  });
  expect(successMock).toHaveBeenCalledWith('Підхід позначено пропущеним.');
});

test('failed request keeps the form open and never claims success', async () => {
  mutateAsync.mockRejectedValue(new Error('Request failed'));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Пропустити підхід' }));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
  await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  expect(successMock).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('form', { name: 'Запис результатів підходу' })).toBeTruthy();
});

test('pending mutation shows accessible status and disables every action', () => {
  useMutationMock.mockReturnValue({
    mutateAsync,
    reset,
    isPending: true,
    isError: false,
    error: null,
    variables: { body: { status: 'SKIPPED' } },
  });
  mount();
  expect(screen.getByRole('status').textContent).toContain('Зберігаємо пропуск підходу');
  expect(
    screen.getByRole('form', { name: 'Запис результатів підходу' }).getAttribute('aria-busy'),
  ).toBe('true');
  for (const button of screen.getAllByRole('button')) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Пропускаємо…' }));
  expect(mutateAsync).not.toHaveBeenCalled();
});
