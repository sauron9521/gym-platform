import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

import { getMessages, type Locale } from '@gym/i18n';

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
import { DashboardActiveWorkout } from '@/widgets/dashboard/ui/dashboard-active-workout';

const workouts = [
  {
    id: 'workout-1',
    title: 'Тренування грудей',
    status: 'IN_PROGRESS',
    startedAt: '2026-11-18T09:00:00Z',
  },
  {
    id: 'workout-2',
    title: 'Тренування спини',
    status: 'IN_PROGRESS',
    startedAt: null,
  },
];

function success(data = workouts, total = data.length) {
  return {
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workouts: data, total, totalPages: 1 },
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
  onAuthFailure.mockReset();
});

afterEach(cleanup);

test('reuses the IN_PROGRESS list query key, shared with the status KPI', () => {
  useQueryMock.mockReturnValue({ isPending: true, isFetching: true, isError: false, error: null });
  renderWithLocale(<DashboardActiveWorkout />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByRole('link', { name: 'Продовжити тренування' })).toBeNull();
  const options = useQueryMock.mock.calls[0]?.[0] as { queryKey: unknown };
  expect(options.queryKey).toEqual(['workouts', 'list', { filter: 'IN_PROGRESS', page: 1 }]);
});

test('only the first in-progress workout can be continued through existing details', () => {
  useQueryMock.mockReturnValue(success(workouts, 4));
  renderWithLocale(<DashboardActiveWorkout />);
  expect(screen.getByRole('heading', { level: 2, name: 'Тренування грудей' })).toBeTruthy();
  const resume = screen.getByRole('link', { name: 'Продовжити тренування' });
  expect(resume.getAttribute('href')).toBe('/workouts/workout-1');
  expect(resume.className).toContain('bg-[var(--brand-teal)]');
  expect(screen.getByText('Усього тренувань у процесі: 4')).toBeTruthy();
  expect(screen.queryByText('Тренування спини')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Створити тренування' })).toBeNull();
  expect(screen.getByText(/Почато:/)).toBeTruthy();
});

test('empty active list delegates to a separately keyed upcoming query', () => {
  useQueryMock.mockReturnValueOnce(success([], 0)).mockReturnValueOnce({
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    data: { workout: null, total: 0 },
  });
  renderWithLocale(<DashboardActiveWorkout />);
  expect(
    screen.getByText(/Зараз немає активних або майбутніх запланованих тренувань/),
  ).toBeTruthy();
  expect(useQueryMock.mock.calls[1]?.[0].queryKey).toEqual(['workouts', 'next-planned']);
  expect(screen.getByRole('link', { name: 'Створити тренування' }).getAttribute('href')).toBe(
    '/workouts/new',
  );
  expect(screen.getByRole('link', { name: 'Відкрити журнал' }).getAttribute('href')).toBe(
    '/workouts',
  );
  expect(screen.queryByRole('link', { name: 'Продовжити тренування' })).toBeNull();
});

test('pending refetch suppresses stale private hero links and titles', () => {
  useQueryMock.mockReturnValue({ ...success(), isFetching: true });
  renderWithLocale(<DashboardActiveWorkout />);
  expect(screen.getByRole('status').textContent).toContain('Завантажуємо');
  expect(screen.queryByText('Тренування грудей')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Продовжити тренування' })).toBeNull();
});

test('429 presents error and retry without creating another workout', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(429),
    data: { workouts, total: 2, totalPages: 1 },
    refetch,
  });
  renderWithLocale(<DashboardActiveWorkout />);
  expect(screen.getByRole('alert').textContent).toContain('Забагато запитів');
  expect(screen.queryByText('Тренування грудей')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Створити тренування' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати знову' }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(429);
});

test('401 hides the entire private hero and delegates to auth recovery', () => {
  useQueryMock.mockReturnValue({
    isPending: false,
    isFetching: false,
    isError: true,
    error: new WorkoutListRequestError(401),
    data: { workouts, total: 2, totalPages: 1 },
  });
  const { container } = renderWithLocale(<DashboardActiveWorkout />);
  expect(container.textContent).toBe('');
  expect(onAuthFailure).toHaveBeenCalledOnce();
  expect((onAuthFailure.mock.calls[0]?.[0] as WorkoutListRequestError).status).toBe(401);
});

test('missing start time is omitted, not replaced by a planned date', () => {
  useQueryMock.mockReturnValue(success([workouts[1]], 1));
  renderWithLocale(<DashboardActiveWorkout />);
  expect(screen.getByText('Тренування спини')).toBeTruthy();
  expect(screen.queryByText(/Почато:/)).toBeNull();
});

test('English active workout uses localized copy, date and safe existing detail link', () => {
  useQueryMock.mockReturnValue(success(workouts, 4));
  renderWithLocale(<DashboardActiveWorkout />, 'en');

  expect(screen.getByRole('heading', { name: 'Тренування грудей' })).toBeTruthy();
  expect(screen.getByText('Workout in progress')).toBeTruthy();
  expect(screen.getByText(/Started: /)).toBeTruthy();
  expect(screen.getByText('Workouts in progress: 4')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Continue workout' }).getAttribute('href')).toBe(
    '/workouts/workout-1',
  );
  expect(screen.getByRole('link', { name: 'Open workout log' }).getAttribute('href')).toBe(
    '/workouts',
  );
});

test('English active 429 keeps private data hidden and offers localized retry', () => {
  const refetch = vi.fn();
  useQueryMock.mockReturnValue({
    ...success(),
    isError: true,
    error: new WorkoutListRequestError(429),
    refetch,
  });
  renderWithLocale(<DashboardActiveWorkout />, 'en');
  expect(screen.getByRole('alert').textContent).toContain('Too many requests');
  expect(screen.queryByText('Тренування грудей')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledOnce();
});
