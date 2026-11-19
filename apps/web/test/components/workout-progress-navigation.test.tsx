import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { WorkoutDetailsData } from '@/features/workouts/lib/workout-details';
import {
  getNextPendingWorkoutSetId,
  getWorkoutSetProgress,
} from '@/features/workouts/lib/workout-set-progress';

vi.mock('@/features/workouts/ui/workout-set-form', () => ({
  WorkoutSetForm: () => <div data-testid="set-editor">Редактор підходу</div>,
}));

import { WorkoutExercises } from '@/features/workouts/ui/workout-exercises';

function workout(status: 'IN_PROGRESS' | 'PLANNED' | 'COMPLETED') {
  return {
    id: 'workout-1',
    status,
    exercises: [
      {
        id: 'exercise-1',
        exerciseNameSnapshot: 'Жим лежачи',
        notes: null,
        sets: [
          { id: 'set-1', setNumber: 1, setType: 'WARMUP', status: 'COMPLETED', notes: null },
          { id: 'set-2', setNumber: 2, setType: 'WORKING', status: 'SKIPPED', notes: null },
          { id: 'set-3', setNumber: 3, setType: 'WORKING', status: 'PENDING', notes: null },
        ],
      },
      {
        id: 'exercise-2',
        exerciseNameSnapshot: 'Присідання',
        notes: null,
        sets: [{ id: 'set-4', setNumber: 1, setType: 'WORKING', status: 'PENDING', notes: null }],
      },
    ],
  } as unknown as WorkoutDetailsData;
}

afterEach(cleanup);

test('derives progress from server statuses, including skipped sets as processed', () => {
  expect(getWorkoutSetProgress(workout('IN_PROGRESS'))).toEqual({
    total: 4,
    completed: 1,
    skipped: 1,
    processed: 2,
    pending: 2,
    nextPendingSetId: 'set-3',
  });
  expect(getWorkoutSetProgress({ exercises: [] })).toEqual({
    total: 0,
    completed: 0,
    skipped: 0,
    processed: 0,
    pending: 0,
    nextPendingSetId: null,
  });
});

test('active session shows accessible progress, mobile exercise links and the next pending set', () => {
  render(
    <WorkoutExercises workout={workout('IN_PROGRESS')} editingSetId={null} onEditSet={vi.fn()} />,
  );
  const meter = screen.getByRole('progressbar', { name: 'Прогрес тренування' });
  expect(meter.getAttribute('value')).toBe('2');
  expect(meter.getAttribute('max')).toBe('4');
  expect(screen.getByText('Опрацьовано 2 із 4')).toBeTruthy();
  const nav = screen.getByRole('navigation', { name: 'Перехід між вправами' });
  expect(nav.querySelectorAll('a')).toHaveLength(2);
  expect(screen.getByRole('link', { name: '1. Жим лежачи' }).getAttribute('href')).toBe(
    '#workout-exercise-exercise-1',
  );
  expect(screen.getByRole('link', { name: '2. Присідання' }).getAttribute('href')).toBe(
    '#workout-exercise-exercise-2',
  );
  expect(screen.getByRole('link', { name: 'До наступного підходу' }).getAttribute('href')).toBe(
    '#workout-set-set-3',
  );
  expect(document.getElementById('workout-set-set-3')).toBeTruthy();
  expect(document.getElementById('workout-exercise-exercise-2')).toBeTruthy();
});

test('after server refresh the next pending target and progress reflect the new response', () => {
  const initial = workout('IN_PROGRESS');
  const view = render(
    <WorkoutExercises workout={initial} editingSetId={null} onEditSet={vi.fn()} />,
  );
  const updated = workout('IN_PROGRESS');
  updated.exercises[0]!.sets[2]!.status = 'COMPLETED';
  view.rerender(<WorkoutExercises workout={updated} editingSetId={null} onEditSet={vi.fn()} />);
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('3');
  expect(screen.getByRole('link', { name: 'До наступного підходу' }).getAttribute('href')).toBe(
    '#workout-set-set-4',
  );
});

test('prevents jump to a different pending set while another result is being edited', () => {
  render(
    <WorkoutExercises workout={workout('IN_PROGRESS')} editingSetId="set-1" onEditSet={vi.fn()} />,
  );
  expect(screen.queryByRole('link', { name: 'До наступного підходу' })).toBeNull();
  expect(screen.getByTestId('set-editor')).toBeTruthy();
});

test('does not advertise active-session navigation for planned or finished workouts', () => {
  for (const status of ['PLANNED', 'COMPLETED'] as const) {
    const view = render(
      <WorkoutExercises workout={workout(status)} editingSetId={null} onEditSet={vi.fn()} />,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Перехід між вправами' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'До наступного підходу' })).toBeNull();
    view.unmount();
  }
});

test('all processed sets do not show an actionable next-set jump', () => {
  const allDone = workout('IN_PROGRESS');
  for (const exercise of allDone.exercises) {
    for (const set of exercise.sets) set.status = 'COMPLETED';
  }
  render(<WorkoutExercises workout={allDone} editingSetId={null} onEditSet={vi.fn()} />);
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('4');
  expect(screen.queryByRole('link', { name: 'До наступного підходу' })).toBeNull();
  expect(
    screen.getByText('Усі підходи опрацьовано. Можна перейти до завершення тренування.'),
  ).toBeTruthy();
});

test('finds the next pending set in order, across exercises, without wrapping backwards', () => {
  const data = workout('IN_PROGRESS');
  expect(getNextPendingWorkoutSetId(data, 'set-1')).toBe('set-3');
  expect(getNextPendingWorkoutSetId(data, 'set-3')).toBe('set-4');
  expect(getNextPendingWorkoutSetId(data, 'set-4')).toBeNull();
  expect(getNextPendingWorkoutSetId(data, 'unknown-set')).toBeNull();
});
