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
import { DashboardCompletedSessions } from '@/widgets/dashboard/ui/dashboard-completed-sessions';

const completed = [
  {
    id: 'workout-1',
    title: 'Жим лежачи',
    status: 'COMPLETED',
    completedAt: '2026-11-10T12:00:00Z',
    exerciseCount: 4,
  },
  {
    id: 'workout-2',
    title: 'Тяга',
    status: 'COMPLETED',
    completedAt: null,
    exerciseCount: 5,
  },
  {
    id: 'workout-3',
    title: 'Присідання',
    status: 'COMPLETED',
    completedAt: '2026-11-12T09:00:00Z',
    exerciseCount: 3,
  },
  {
    id: 'workout-4',
    title: 'Розтяжка',
    status: 'COMPLETED',
    completedAt: '2026-11-14T09:00:00Z',
    exerciseCount: 2,
  },
];

beforeEach(() => {
  useQueryMock.mockReset();
  onAuthFailure.mockReset();
});

afterEach(cleanup);

test('uses the existing completed-workout query key and displays loading status', () => {
  useQueryMock.mockReturnValue({ isPending: true, isFetching: true, isError: false, error: null });
  render(<DashboardCompletedSessions />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByRole('link', { name: 'Деталі' })).toBeNull();
  const options = useQueryMock.mock.calls[0]?.[0] as { queryKey: unknown };
  expect(options.queryKey).toEqual(['workouts', 'list', { filter: 'COMPLETED', page: 1 }]);
});

test('shows at most three real records in API order without inventing dates', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workouts: completed, total: 22, totalPages: 3 },
  });
  render(<DashboardCompletedSessions />);
  expect(screen.getAllByRole('link', { name: 'Деталі' })).toHaveLength(3);
  expect(screen.getByText('Жим лежачи')).toBeTruthy();
  expect(screen.queryByText('Розтяжка')).toBeNull();
  expect(screen.getByText('Завершено: Час завершення не вказано')).toBeTruthy();
  expect(screen.getByText('Вправ: 4')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Деталі' })[0].getAttribute('href')).toBe(
    '/workouts/workout-1',
  );
  expect(screen.getByText('Останні додані записи серед завершених тренувань.')).toBeTruthy();
});

test('shows a real empty state without a fabricated completion count', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workouts: [], total: 0, totalPages: 1 },
  });
  render(<DashboardCompletedSessions />);
  expect(screen.getByText('Поки немає завершених тренувань.')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Деталі' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Відкрити журнал' }).getAttribute('href')).toBe(
    '/workouts',
  );
});

test('keeps private records hidden during a refetch', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: true,
    isError: false,
    error: null,
    data: { workouts: completed, total: 22, totalPages: 3 },
  });
  render(<DashboardCompletedSessions />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByText('Жим лежачи')).toBeNull();
});

test('surfaces rate-limit errors with retry instead of stale records', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(429),
    data: { workouts: completed, total: 4, totalPages: 1 },
    refetch,
  });
  render(<DashboardCompletedSessions />);
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  expect(screen.queryByText('Жим лежачи')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати знову' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(onAuthFailure).not.toHaveBeenCalled();
});

test('does not expose stale workouts after 401, triggers auth recovery', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(401),
    data: { workouts: completed, total: 4, totalPages: 1 },
  });
  const { container } = render(<DashboardCompletedSessions />);
  expect(container.textContent).toBe('');
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(401);
});
