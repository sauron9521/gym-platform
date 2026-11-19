import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { useQueryMock, authFailure, getMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  authFailure: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }));
vi.mock('@/shared/api/use-auth-failure', () => ({ useAuthFailure: () => authFailure }));
vi.mock('@/shared/api/client', () => ({ webApi: { GET: getMock } }));

import {
  DashboardPersonalRecords,
  PersonalRecordsRequestError,
} from '@/widgets/dashboard/ui/dashboard-personal-records';

const success = (exerciseCount: number) => ({
  isPending: false,
  isFetching: false,
  isError: false,
  error: null,
  data: { exerciseCount, asOf: '2026-11-18T12:00:00.000Z' },
});

beforeEach(() => {
  useQueryMock.mockReset();
  authFailure.mockReset();
  getMock.mockReset();
});
afterEach(cleanup);

test('shows one confirmed lifetime weight best per exercise, not an event count', () => {
  useQueryMock.mockReturnValue(success(3));
  render(<DashboardPersonalRecords />);
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.getByText(/Вправ із зафіксованою найкращою вагою/)).toBeTruthy();
  expect(useQueryMock.mock.lastCall?.[0].queryKey).toEqual([
    'workout-analytics',
    'personal-records',
  ]);
});

test('shows a verified zero rather than an invented record', () => {
  useQueryMock.mockReturnValue(success(0));
  render(<DashboardPersonalRecords />);
  expect(screen.getByText('0')).toBeTruthy();
});

test('does not leak cached count during refetch or after 401', () => {
  useQueryMock.mockReturnValue({ ...success(5), isFetching: true });
  const { rerender } = render(<DashboardPersonalRecords />);
  expect(screen.queryByText('5')).toBeNull();
  expect(screen.getByRole('status')).toBeTruthy();

  const error = new PersonalRecordsRequestError(401);
  useQueryMock.mockReturnValue({ ...success(5), isFetching: false, isError: true, error });
  rerender(<DashboardPersonalRecords />);
  expect(screen.queryByText('5')).toBeNull();
  expect(authFailure).toHaveBeenCalledWith(error);
});

test('lets the user retry a 429 without falsely resetting the session', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    ...success(0),
    isError: true,
    error: new PersonalRecordsRequestError(429),
    refetch,
  });
  render(<DashboardPersonalRecords />);
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  fireEvent.click(screen.getByRole('button', { name: 'Повторити' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(authFailure).not.toHaveBeenCalled();
});

test('queries only authenticated personal-records endpoint with a cancellation signal', async () => {
  getMock.mockResolvedValue({
    response: { status: 200 },
    data: { exerciseCount: 2, asOf: '2026-11-18T12:00:00.000Z' },
  });
  useQueryMock.mockReturnValue(success(2));
  render(<DashboardPersonalRecords />);
  const signal = new AbortController().signal;
  const result = await useQueryMock.mock.lastCall?.[0].queryFn({ signal });
  expect(result.exerciseCount).toBe(2);
  expect(getMock).toHaveBeenCalledWith('/workout-analytics/personal-records', { signal });
});
