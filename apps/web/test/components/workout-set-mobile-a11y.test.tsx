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

const set = {
  id: 'set-mobile',
  setNumber: 2,
  status: 'PENDING',
  plannedReps: 8,
  plannedWeightKg: '80',
  actualReps: null,
  actualWeightKg: null,
  actualDurationSeconds: null,
  actualDistanceMeters: null,
  restSeconds: null,
  rpe: null,
  rir: null,
  notes: null,
} as unknown as WorkoutSetData;

const mutation = vi.fn();
const reset = vi.fn();

function mount() {
  return render(
    <WorkoutSetForm
      workoutId="workout-mobile"
      set={set}
      onSaved={vi.fn()}
      onSavedAndNext={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockReturnValue({
    mutateAsync: mutation,
    reset,
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
  });
});

afterEach(cleanup);

test('opens the quick editor with keyboard focus and mobile-safe single-column controls', () => {
  const { container } = mount();
  const form = screen.getByRole('form', { name: 'Запис результатів підходу' });
  const reps = screen.getByRole('textbox', { name: 'Повторення' });
  const weight = screen.getByRole('textbox', { name: 'Вага (кг)' });

  expect(document.activeElement).toBe(reps);
  expect(form.className).toContain('min-w-0');
  expect(form.className).toContain('p-3');
  expect(reps.className).toContain('focus-visible:outline-2');
  expect(weight.className).toContain('min-w-0');

  const fieldGrid = reps.closest('.grid');
  expect(fieldGrid?.className).toContain('grid-cols-1');
  expect(fieldGrid?.className).toContain('sm:grid-cols-2');

  const actions = screen.getByRole('button', { name: 'Позначити виконаним' }).parentElement;
  expect(actions?.className).toContain('grid-cols-1');
  expect(actions?.className).toContain('sm:flex');
  for (const button of screen.getAllByRole('button')) {
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('w-full');
  }
  const disclosure = container.querySelector('summary');
  expect(disclosure?.className).toContain('focus-visible:outline-2');
});

test('invalid notes expand the disclosure, connect alert to field and focus it', async () => {
  const { container } = mount();
  const notes = container.querySelector('textarea');
  if (!notes) throw new Error('Expected notes textarea');
  const disclosure = notes.closest('details');
  expect(disclosure?.open).toBe(false);

  fireEvent.change(notes, { target: { value: 'x'.repeat(5001) } });
  fireEvent.click(screen.getByRole('button', { name: 'Позначити виконаним' }));

  await waitFor(() => expect(disclosure?.open).toBe(true));
  await waitFor(() => expect(notes.getAttribute('aria-invalid')).toBe('true'));
  expect(notes.getAttribute('aria-describedby')).toBe('workout-set-set-mobile-notes-error');
  expect(document.getElementById('workout-set-set-mobile-notes-error')?.getAttribute('role')).toBe(
    'alert',
  );
  await waitFor(() => expect(document.activeElement).toBe(notes));
  expect(mutation).not.toHaveBeenCalled();
});

test('invalid advanced numeric field is made visible and keyboard-focused', async () => {
  const { container } = mount();
  const duration = container.querySelector<HTMLInputElement>(
    '#workout-set-set-mobile-actualDurationSeconds',
  );
  if (!duration) throw new Error('Expected duration field');

  fireEvent.change(duration, { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти й наступний' }));
  await waitFor(() => expect(duration.closest('details')?.open).toBe(true));
  await waitFor(() => expect(document.activeElement).toBe(duration));
  expect(duration.getAttribute('aria-invalid')).toBe('true');
  expect(duration.getAttribute('aria-describedby')).toBe(
    'workout-set-set-mobile-actualDurationSeconds-error',
  );
  expect(mutation).not.toHaveBeenCalled();
});

test('mutation failure remains announced and never claims completion', () => {
  useMutationMock.mockReturnValue({
    mutateAsync: mutation,
    reset,
    isPending: false,
    isError: true,
    error: new Error('Забагато запитів. Спробуйте пізніше.'),
    variables: undefined,
  });
  mount();
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  expect(successMock).not.toHaveBeenCalled();
});
