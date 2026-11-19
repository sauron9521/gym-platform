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

vi.mock('@/widgets/dashboard/ui/dashboard-personal-records', () => ({
  DashboardPersonalRecords: () => <div data-testid="personal-records-kpi" />,
}));

import { WorkoutListRequestError } from '@/features/workouts/api/workouts-list-query';
import { DashboardWorkoutStats } from '@/widgets/dashboard/ui/dashboard-workout-stats';

type Status = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

function success(total: number) {
  return {
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { total, workouts: [], totalPages: 1 },
  };
}

function mockStatuses(results: Record<Status, unknown>) {
  useQueryMock.mockImplementation(
    (options: { queryKey: readonly [string, string, { filter: Status; page: number }] }) =>
      results[options.queryKey[2].filter],
  );
}

beforeEach(() => {
  useQueryMock.mockReset();
  onAuthFailure.mockReset();
});

afterEach(cleanup);

test('reads exact server totals using three existing owner-scoped query keys', () => {
  mockStatuses({ PLANNED: success(12), IN_PROGRESS: success(1), COMPLETED: success(47) });
  render(<DashboardWorkoutStats />);

  expect(screen.getByRole('heading', { name: 'Мої тренування в цифрах' })).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
  expect(screen.getByText('47')).toBeTruthy();
  expect(useQueryMock.mock.calls.map(([options]) => options.queryKey)).toEqual([
    ['workouts', 'list', { filter: 'PLANNED', page: 1 }],
    ['workouts', 'list', { filter: 'IN_PROGRESS', page: 1 }],
    ['workouts', 'list', { filter: 'COMPLETED', page: 1 }],
  ]);
});

test('shows loading instead of displaying stale totals during refetch', () => {
  mockStatuses({
    PLANNED: { ...success(12), isFetching: true },
    IN_PROGRESS: { ...success(1), isPending: true },
    COMPLETED: success(3),
  });
  render(<DashboardWorkoutStats />);
  expect(screen.getAllByRole('status')).toHaveLength(2);
  expect(screen.queryByText('12')).toBeNull();
  expect(screen.queryByText('1')).toBeNull();
  expect(screen.getByText('3')).toBeTruthy();
});

test('zero is only displayed after a confirmed successful API response', () => {
  mockStatuses({ PLANNED: success(0), IN_PROGRESS: success(0), COMPLETED: success(0) });
  render(<DashboardWorkoutStats />);
  expect(screen.getAllByText('0')).toHaveLength(3);
});

test('429 shows per-card retry and leaves other successful counters visible', () => {
  const refetch = vi.fn();
  mockStatuses({
    PLANNED: success(4),
    IN_PROGRESS: success(2),
    COMPLETED: {
      isPending: false,
      isFetching: false,
      isError: true,
      error: new WorkoutListRequestError(429),
      refetch,
    },
  });
  render(<DashboardWorkoutStats />);
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  fireEvent.click(screen.getByRole('button', { name: 'Повторити завантаження: завершені' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(onAuthFailure).not.toHaveBeenCalled();
});

test('a 401 anywhere hides all cached counts and delegates session invalidation', () => {
  mockStatuses({
    PLANNED: success(12),
    IN_PROGRESS: {
      isPending: false,
      isFetching: false,
      isError: true,
      error: new WorkoutListRequestError(401),
      data: { total: 1, workouts: [], totalPages: 1 },
    },
    COMPLETED: success(47),
  });
  const { container } = render(<DashboardWorkoutStats />);
  expect(container.textContent).toBe('');
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(401);
});

test('missing summary data is not converted to a made-up zero', () => {
  mockStatuses({
    PLANNED: { ...success(0), data: undefined },
    IN_PROGRESS: success(1),
    COMPLETED: success(7),
  });
  render(<DashboardWorkoutStats />);
  expect(screen.getByRole('status').textContent).toContain('Дані недоступні');
  expect(screen.queryByText('0')).toBeNull();
});
