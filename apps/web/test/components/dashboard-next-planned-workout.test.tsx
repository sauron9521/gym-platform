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
import { DashboardNextPlannedWorkout } from '@/widgets/dashboard/ui/dashboard-next-planned-workout';

const scheduled = {
  id: 'upcoming-workout',
  title: 'Тренування ніг',
  status: 'PLANNED',
  scheduledAt: '2035-04-02T09:00:00Z',
  exerciseCount: 5,
};

function success(workout: typeof scheduled | null = scheduled) {
  return {
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workout, total: workout ? 1 : 0, requestedFrom: '2026-11-18T00:00:00Z' },
  };
}

beforeEach(() => {
  useQueryMock.mockReset();
  onAuthFailure.mockReset();
});

afterEach(cleanup);

test('uses a dedicated chronological query and shows the real scheduled time and exercise count', () => {
  useQueryMock.mockReturnValue(success());
  render(<DashboardNextPlannedWorkout />);
  expect(useQueryMock.mock.calls[0]?.[0].queryKey).toEqual(['workouts', 'next-planned']);
  expect(screen.getByText('Найближче заплановане тренування')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Тренування ніг' })).toBeTruthy();
  expect(screen.getByText(/Заплановано:/)).toBeTruthy();
  expect(screen.getByText('Вправ: 5')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Переглянути та розпочати' }).getAttribute('href')).toBe(
    '/workouts/upcoming-workout',
  );
});

test('shows create action only when no upcoming workout exists', () => {
  useQueryMock.mockReturnValue(success(null));
  render(<DashboardNextPlannedWorkout />);
  expect(screen.getByRole('link', { name: 'Створити тренування' }).getAttribute('href')).toBe(
    '/workouts/new',
  );
  expect(screen.queryByRole('link', { name: 'Переглянути та розпочати' })).toBeNull();
});

test('loading and refetch hide private cached workout details', () => {
  useQueryMock.mockReturnValue({ ...success(), isFetching: true });
  render(<DashboardNextPlannedWorkout />);
  expect(screen.getByRole('status').textContent).toContain('Перевіряємо');
  expect(screen.queryByText('Тренування ніг')).toBeNull();
});

test('stale past scheduled timestamps cannot be shown as upcoming', () => {
  useQueryMock.mockReturnValue(success({ ...scheduled, scheduledAt: '2020-01-01T00:00:00Z' }));
  render(<DashboardNextPlannedWorkout />);
  expect(screen.getByRole('link', { name: 'Створити тренування' })).toBeTruthy();
  expect(screen.queryByText('Тренування ніг')).toBeNull();
});

test('429 shows retry without exposing cached data or triggering logout', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(429),
    data: { workout: scheduled, total: 1 },
    refetch,
  });
  render(<DashboardNextPlannedWorkout />);
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  expect(screen.queryByText('Тренування ніг')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати знову' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(429);
});

test('401 clears the private hero and delegates to centralized sign-in recovery', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(401),
    data: { workout: scheduled, total: 1 },
  });
  const { container } = render(<DashboardNextPlannedWorkout />);
  expect(container.textContent).toBe('');
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(401);
});
