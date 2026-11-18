import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { useQueryMock, authFailure } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  authFailure: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }));
vi.mock('@/shared/api/use-auth-failure', () => ({ useAuthFailure: () => authFailure }));

import { DashboardVolumeChart } from '@/widgets/dashboard/ui/dashboard-volume-chart';

beforeEach(() => {
  useQueryMock.mockReset();
  authFailure.mockReset();
});
afterEach(cleanup);

test('renders API-backed daily volumes, accessible values, and switches range', () => {
  useQueryMock.mockImplementation((options: { queryKey: readonly string[] }) => ({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: {
      daily: [{ date: '2026-11-17', strengthVolumeKg: 1500 }],
      workoutCount: 1,
      activeDays: 1,
      asOf: '2026-11-18T12:00:00.000Z',
    },
    refetch: vi.fn(),
  }));
  render(<DashboardVolumeChart />);
  expect(screen.getByText('1500 кг')).toBeTruthy();
  expect(screen.getByRole('button', { name: '30 днів' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '7 днів' }));
  expect(screen.getByRole('button', { name: '7 днів' }).getAttribute('aria-pressed')).toBe('true');
  expect(useQueryMock.mock.lastCall?.[0].queryKey).toEqual(['workout-analytics', 'summary', '7d']);
});

test('does not show stale analytics while changing range', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: true,
    isError: false,
    error: null,
    data: { daily: [{ date: '2026-11-17', strengthVolumeKg: 1200 }] },
  });
  render(<DashboardVolumeChart />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByText('1200 кг')).toBeNull();
});

test('shows empty state for zero volume', () => {
  useQueryMock.mockReturnValue({
    isPending: false, isFetching: false, isError: false, error: null,
    data: { daily: [], workoutCount: 0, activeDays: 0, asOf: '2026-11-18T12:00:00.000Z' },
  });
  render(<DashboardVolumeChart />);
  expect(screen.getByText(/немає записаного силового об’єму/)).toBeTruthy();
});
