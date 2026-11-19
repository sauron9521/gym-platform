import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import type { WorkoutDetailsData } from '@/features/workouts/lib/workout-details';

vi.mock('@/features/workouts/ui/workout-set-form', () => ({
  WorkoutSetForm: ({
    onSaved,
    onSavedAndNext,
    onClose,
  }: {
    onSaved: () => void;
    onSavedAndNext?: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="set-editor">
      <button type="button" onClick={onSaved}>
        Тестове збереження
      </button>
      {onSavedAndNext && (
        <button type="button" onClick={onSavedAndNext}>
          Тестовий наступний
        </button>
      )}
      <button type="button" onClick={onClose}>
        Тестове закриття
      </button>
    </div>
  ),
}));

import { WorkoutExercises } from '@/features/workouts/ui/workout-exercises';

const setFields = {
  plannedDurationSeconds: null,
  actualDurationSeconds: null,
  plannedDistanceMeters: null,
  actualDistanceMeters: null,
  notes: null,
  updatedAt: '2026-11-19T07:00:00.000Z',
};

function exampleWorkout(status: 'IN_PROGRESS' | 'COMPLETED' | 'PLANNED') {
  return {
    id: 'workout-1',
    status,
    exercises: [
      {
        id: 'exercise-1',
        exerciseNameSnapshot: 'Жим лежачи',
        notes: 'Контролюй техніку',
        sets: [
          {
            ...setFields,
            id: 'set-1',
            setNumber: 1,
            setType: 'WARMUP',
            status: 'PENDING',
            plannedReps: 12,
            actualReps: null,
            plannedWeightKg: 40,
            actualWeightKg: null,
          },
          {
            ...setFields,
            id: 'set-2',
            setNumber: 2,
            setType: 'WORKING',
            status: 'COMPLETED',
            plannedReps: 8,
            actualReps: 8,
            plannedWeightKg: 60,
            actualWeightKg: 62.5,
            notes: 'Виконано без допомоги',
          },
          {
            ...setFields,
            id: 'set-3',
            setNumber: 3,
            setType: 'WORKING',
            status: 'SKIPPED',
            plannedReps: 8,
            actualReps: null,
            plannedWeightKg: 60,
            actualWeightKg: null,
          },
        ],
      },
    ],
  } as unknown as WorkoutDetailsData;
}

afterEach(cleanup);

test('shows real pending, completed and skipped statuses in a compact set list', () => {
  render(
    <WorkoutExercises
      workout={exampleWorkout('IN_PROGRESS')}
      editingSetId={null}
      onEditSet={vi.fn()}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Вправи (1)' })).toBeTruthy();
  const exercise = screen.getByRole('article', { name: 'Жим лежачи' });
  expect(within(exercise).getByText('Виконано 1 із 3')).toBeTruthy();
  const sets = within(exercise).getByRole('list', { name: 'Підходи: Жим лежачи' });
  expect(within(sets).getAllByRole('listitem')).toHaveLength(3);
  expect(within(sets).getByText('Очікує')).toBeTruthy();
  expect(within(sets).getByText('Виконано')).toBeTruthy();
  expect(within(sets).getByText('Пропущено')).toBeTruthy();
  expect(within(sets).getByText('62,5 кг')).toBeTruthy();
  expect(within(sets).getByText('Виконано без допомоги')).toBeTruthy();
});

test('opens one set editor and locks other set actions until it closes', () => {
  const onEditSet = vi.fn();
  const workout = exampleWorkout('IN_PROGRESS');
  const view = render(
    <WorkoutExercises workout={workout} editingSetId={null} onEditSet={onEditSet} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Записати результат' }));
  expect(onEditSet).toHaveBeenCalledWith('set-1');

  view.rerender(<WorkoutExercises workout={workout} editingSetId="set-1" onEditSet={onEditSet} />);
  expect(screen.getByTestId('set-editor')).toBeTruthy();
  for (const button of screen.getAllByRole('button', { name: 'Змінити результат' })) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Тестове збереження' }));
  expect(onEditSet).toHaveBeenLastCalledWith(null);
});

test('never offers set editing for a finished or planned workout', () => {
  for (const status of ['COMPLETED', 'PLANNED'] as const) {
    const view = render(
      <WorkoutExercises workout={exampleWorkout(status)} editingSetId={null} onEditSet={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Записати результат' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Змінити результат' })).toBeNull();
    view.unmount();
  }
});

test('handles an empty exercise and missing performance without inventing values', () => {
  const workout = {
    id: 'workout-2',
    status: 'COMPLETED',
    exercises: [
      { id: 'exercise-empty', exerciseNameSnapshot: 'Планка', notes: null, sets: [] },
      {
        id: 'exercise-timed',
        exerciseNameSnapshot: 'Велотренажер',
        notes: null,
        sets: [
          {
            ...setFields,
            id: 'set-timed',
            setNumber: 1,
            setType: 'WORKING',
            status: 'COMPLETED',
            plannedReps: null,
            actualReps: null,
            plannedWeightKg: null,
            actualWeightKg: null,
            plannedDurationSeconds: 90,
            actualDurationSeconds: 95,
            plannedDistanceMeters: 300,
            actualDistanceMeters: 310,
          },
        ],
      },
    ],
  } as unknown as WorkoutDetailsData;

  render(<WorkoutExercises workout={workout} editingSetId={null} onEditSet={vi.fn()} />);
  expect(screen.getByText('Підходів ще немає.')).toBeTruthy();
  expect(screen.getByText('Тривалість')).toBeTruthy();
  expect(screen.getByText('Дистанція')).toBeTruthy();
  expect(screen.queryByText('Вага')).toBeNull();
});

test('renders a useful empty state when no exercises exist', () => {
  const workout = { id: 'workout-3', status: 'PLANNED', exercises: [] };
  render(
    <WorkoutExercises
      workout={workout as unknown as WorkoutDetailsData}
      editingSetId={null}
      onEditSet={vi.fn()}
    />,
  );
  expect(screen.getByText('У цьому тренуванні ще немає вправ.')).toBeTruthy();
});

test('save-and-next targets the next pending set without reopening completed sets', () => {
  const workout = exampleWorkout('IN_PROGRESS');
  workout.exercises[0]!.sets[2]!.status = 'PENDING';
  const onEditSet = vi.fn();
  render(<WorkoutExercises workout={workout} editingSetId="set-1" onEditSet={onEditSet} />);
  fireEvent.click(screen.getByRole('button', { name: 'Тестовий наступний' }));
  expect(onEditSet).toHaveBeenCalledExactlyOnceWith('set-3');
});

test('save-and-next is unavailable when no subsequent pending set exists', () => {
  const workout = exampleWorkout('IN_PROGRESS');
  render(<WorkoutExercises workout={workout} editingSetId="set-1" onEditSet={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Тестовий наступний' })).toBeNull();
});
