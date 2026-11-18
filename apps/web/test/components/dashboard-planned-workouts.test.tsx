import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { useQueryMock, onAuthFailure } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  onAuthFailure: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  queryOptions: (options: unknown) => options,
}));

vi.mock('@/shared/api/use-auth-failure', () => ({
  useAuthFailure: () => onAuthFailure,
}));

import { WorkoutListRequestError } from '@/features/workouts/api/workouts-list-query';
import { DashboardPlannedWorkouts } from '@/widgets/dashboard/ui/dashboard-planned-workouts';

const planned = [
  {
    id: 'workout-1',
    title: 'Силове тренування',
    status: 'PLANNED',
    scheduledAt: null,
    exerciseCount: 4,
  },
  {
    id: 'workout-2',
    title: 'Ноги',
    status: 'PLANNED',
    scheduledAt: '2026-11-23T10:00:00Z',
    exerciseCount: 3,
  },
  { id: 'workout-3', title: 'Спина', status: 'PLANNED', scheduledAt: null, exerciseCount: 5 },
  { id: 'workout-4', title: 'Груди', status: 'PLANNED', scheduledAt: null, exerciseCount: 2 },
];

beforeEach(() => {
  useQueryMock.mockReset();
  onAuthFailure.mockReset();
});

afterEach(cleanup);

test('reuses the existing filtered athlete query and shows a loading state', () => {
  useQueryMock.mockReturnValue({ isPending: true, isFetching: true, isError: false, error: null });
  render(<DashboardPlannedWorkouts />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByRole('link', { name: 'Переглянути' })).toBeNull();
  const options = useQueryMock.mock.calls[0]?.[0] as { queryKey: unknown };
  expect(options.queryKey).toEqual(['workouts', 'list', { filter: 'PLANNED', page: 1 }]);
});

test('shows real total and at most three most recently added planned workouts', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workouts: planned, total: 12, totalPages: 2 },
  });
  render(<DashboardPlannedWorkouts />);
  expect(screen.getByText('Усього заплановано: 12')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Переглянути' })).toHaveLength(3);
  expect(screen.getByText('Силове тренування')).toBeTruthy();
  expect(screen.queryByText('Груди')).toBeNull();
  expect(screen.getAllByRole('link', { name: 'Переглянути' })[0].getAttribute('href')).toBe(
    '/workouts/workout-1',
  );
  expect(screen.getAllByText('Заплановано: Не заплановано')).toHaveLength(2);
});

test('shows an honest empty state and existing creation route', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workouts: [], total: 0, totalPages: 1 },
  });
  render(<DashboardPlannedWorkouts />);
  expect(screen.getByText('Поки немає запланованих тренувань.')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Створити тренування' }).getAttribute('href')).toBe(
    '/workouts/new',
  );
});

test('shows API errors with retry instead of fabricated workout data', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(429),
    refetch,
  });
  render(<DashboardPlannedWorkouts />);
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати знову' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(onAuthFailure).toHaveBeenCalledOnce();
});

test('never renders stale private data after 401 and delegates session clear', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(401),
    data: { workouts: planned, total: 4, totalPages: 1 },
  });
  const { container } = render(<DashboardPlannedWorkouts />);
  expect(container.textContent).not.toContain('Силове тренування');
  expect(container.textContent).toBe('');
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(401);
});
