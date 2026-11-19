import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

import { getMessages, type Locale } from '@gym/i18n';

const { useQueryMock, authFailure } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  authFailure: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }));
vi.mock('@/shared/api/use-auth-failure', () => ({
  useAuthFailure: () => authFailure,
}));

import {
  AnalyticsError,
  DashboardVolumeChart,
} from '@/widgets/dashboard/ui/dashboard-volume-chart';

const volume = {
  daily: [{ date: '2026-11-17', strengthVolumeKg: 1500 }],
  workoutCount: 4,
  activeDays: 3,
  asOf: '2026-11-18T12:00:00.000Z',
};

function success(data: typeof volume = volume) {
  return {
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data,
    refetch: vi.fn(),
  };
}

function renderWithLocale(element: ReactElement, locale: Locale = 'uk') {
  return render(
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  useQueryMock.mockReset();
  authFailure.mockReset();
});
afterEach(cleanup);

test('Ukrainian chart exposes API-backed daily values and preserves 7/30/90 query keys', () => {
  useQueryMock.mockReturnValue(success());
  renderWithLocale(<DashboardVolumeChart />);

  expect(screen.getByRole('heading', { name: 'Прогрес тренувань' })).toBeTruthy();
  expect(screen.getByRole('img', { name: /Графік силового об’єму за 30 днів/ })).toBeTruthy();
  fireEvent.click(screen.getByText('Переглянути точні значення за днями'));
  const values = screen.getByRole('list', { name: 'Денні значення об’єму' });
  expect(values.textContent).toContain(new Intl.NumberFormat('uk-UA').format(1500));
  expect(values.textContent).toContain('кг');
  expect(values.querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-17');
  expect(values.querySelector('time')?.textContent).not.toBe('2026-11-17');
  expect(screen.getByText(/Дані API станом на/)).toBeTruthy();
  expect(useQueryMock.mock.lastCall?.[0].queryKey).toEqual([
    'workout-analytics',
    'summary',
    '30d',
  ]);

  const period = screen.getByRole('group', { name: 'Період графіка' });
  fireEvent.click(screen.getByRole('button', { name: '7 днів' }));
  expect(screen.getByRole('button', { name: '7 днів' }).getAttribute('aria-pressed')).toBe('true');
  expect(useQueryMock.mock.lastCall?.[0].queryKey).toEqual([
    'workout-analytics',
    'summary',
    '7d',
  ]);

  fireEvent.click(screen.getByRole('button', { name: '90 днів' }));
  expect(screen.getByRole('button', { name: '90 днів' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(period.getAttribute('aria-label')).toBe('Період графіка');
  expect(useQueryMock.mock.lastCall?.[0].queryKey).toEqual([
    'workout-analytics',
    'summary',
    '90d',
  ]);
});

test('English labels, daily dates, numbers, tooltip and summary use request locale', () => {
  useQueryMock.mockReturnValue(success());
  renderWithLocale(<DashboardVolumeChart />, 'en');

  expect(screen.getByRole('heading', { name: 'Workout progress' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '30 days' })).toBeTruthy();
  expect(
    screen.getByRole('img', { name: /Strength-training volume chart for 30 days/ }),
  ).toBeTruthy();
  expect(screen.getByText('Training volume, kg')).toBeTruthy();
  expect(screen.getByText('View exact daily values')).toBeTruthy();

  fireEvent.click(screen.getByText('View exact daily values'));
  const values = screen.getByRole('list', { name: 'Daily training volume values' });
  expect(values.querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-17');
  expect(values.querySelector('time')?.textContent).toMatch(/Nov.*17.*2026/);
  expect(values.textContent).toContain('1,500 kg');
  const bar = screen.getByTitle(/Nov.*17.*2026.*1,500 kg/);
  expect(bar).toBeTruthy();
  expect(screen.getByText(/Workouts: 4. Active days: 3. API data as of/)).toBeTruthy();
});

test('fetching a new range hides stale private graph and exact numbers', () => {
  useQueryMock.mockReturnValue({ ...success(), isFetching: true });
  renderWithLocale(<DashboardVolumeChart />, 'en');
  expect(screen.getByRole('status').textContent).toContain('Loading chart');
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('list')).toBeNull();
  expect(screen.queryByText(/Workouts: 4/)).toBeNull();
});

test('empty response remains an empty state, not a fabricated graph', () => {
  useQueryMock.mockReturnValue(success({ ...volume, daily: [], workoutCount: 0, activeDays: 0 }));
  renderWithLocale(<DashboardVolumeChart />, 'en');
  expect(screen.getByText('No recorded strength-training volume for the selected period.')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});

test('English rate limit uses translated message and accessible retry without logging out', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    ...success(),
    isError: true,
    error: new AnalyticsError(429),
    refetch,
  });
  renderWithLocale(<DashboardVolumeChart />, 'en');
  expect(screen.getByRole('alert').textContent).toContain('Too many requests');
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading chart' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(authFailure).not.toHaveBeenCalled();
});

test('401 invalidates session and hides cached chart completely', () => {
  const error = new AnalyticsError(401);
  useQueryMock.mockReturnValue({
    ...success(),
    isError: true,
    error,
  });
  const { container } = renderWithLocale(<DashboardVolumeChart />, 'en');
  expect(container.textContent).toBe('');
  expect(authFailure).toHaveBeenCalledWith(error);
});
