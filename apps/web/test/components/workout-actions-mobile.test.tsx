import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { WorkoutDetailsData } from '@/features/workouts/lib/workout-details';

const { useMutationMock } = vi.hoisted(() => ({ useMutationMock: vi.fn() }));

vi.mock('@/features/workouts/api/workout-mutations', () => ({
  useWorkoutActionMutation: useMutationMock,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { WorkoutActions } from '@/features/workouts/ui/workout-actions';

const workout = {
  id: 'workout-mobile',
  status: 'IN_PROGRESS',
  exercises: [
    {
      sets: [
        { id: 'set-1', status: 'COMPLETED' },
        { id: 'set-2', status: 'SKIPPED' },
      ],
    },
  ],
} as unknown as WorkoutDetailsData;

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
});

afterEach(cleanup);

test('active workout actions have full-width touch targets and accessible confirmation', () => {
  render(<WorkoutActions workout={workout} onReload={vi.fn()} />);
  const complete = screen.getByRole('button', { name: 'Завершити тренування' });
  const cancel = screen.getByRole('button', { name: 'Скасувати тренування' });
  expect(complete.className).toContain('w-full');
  expect(complete.className).toContain('min-h-11');
  expect(cancel.className).toContain('w-full');

  fireEvent.click(complete);
  const group = screen.getByRole('group', { name: 'Підтвердження дії' });
  expect(group.textContent).toContain('Після завершення');
  const confirm = screen.getByRole('button', { name: 'Підтвердити' });
  expect(confirm.className).toContain('min-h-11');
  expect(confirm.className).toContain('w-full');
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  expect(screen.queryByRole('group', { name: 'Підтвердження дії' })).toBeNull();
});

test('pending workout action disables each touch control', () => {
  useMutationMock.mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: true,
    isError: false,
    error: null,
  });
  render(<WorkoutActions workout={workout} onReload={vi.fn()} />);
  for (const button of screen.getAllByRole('button')) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
});
