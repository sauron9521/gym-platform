import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Locale } from '@gym/i18n';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { IntlProvider } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { useEffect } from 'react';
import {
  RestTimerProvider,
  useRestTimerStore,
} from '@/features/workouts/model/rest-timer-provider';
import { WorkoutsScreen } from '@/screens/workouts/ui/workouts-screen';
import {
  MobileAccessDeniedError,
  MobileReadHttpError,
  MobileSessionExpiredError,
} from '@/shared/api/api-error-policy';

const push = vi.fn();
vi.mock('@/features/workouts/lib/use-rest-feedback', () => ({
  useRestFeedback: () => () => undefined,
}));
const fetchNextPage = vi.fn();
const refetch = vi.fn();

vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/workouts/model/workouts-query', () => ({ useWorkoutsQuery: vi.fn() }));

type Query = ReturnType<typeof useWorkoutsQuery>;

function prepare(
  role: 'ATHLETE' | 'TRAINER',
  pageError = false,
  overrides: Record<string, unknown> = {},
) {
  vi.mocked(useAuth).mockReturnValue({
    account: { id: 'user-1', role },
    capabilities: { athlete: role === 'ATHLETE', trainer: role === 'TRAINER', admin: false },
  } as unknown as ReturnType<typeof useAuth>);

  vi.mocked(useWorkoutsQuery).mockReturnValue({
    data: {
      pages: [
        { data: [{ id: 'one', title: 'Силове', status: 'IN_PROGRESS', scheduledAt: null }] },
        { data: [{ id: 'one', title: 'Силове', status: 'IN_PROGRESS', scheduledAt: null }] },
      ],
    },
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    isRefetching: false,
    hasNextPage: pageError,
    isFetchingNextPage: false,
    isFetchNextPageError: pageError,
    fetchNextPage,
    refetch,
    ...overrides,
  } as unknown as Query);
}

function screenFor(locale: Locale) {
  return render(
    <IntlProvider locale={locale} defaultLocale="uk" messages={getMobileMessages(locale)}>
      <RestTimerProvider
        accountId={null}
        defaultDuration={90}
        feedback={{ sound: false, vibration: false }}
      >
        <WorkoutsScreen />
      </RestTimerProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prepare('ATHLETE');
});
afterEach(async () => {
  await cleanup();
});

describe('WorkoutsScreen native pagination and localized copy', () => {
  it('shows a localized continuation shortcut independently of the selected list filter', async () => {
    function SeedWorkout() {
      const store = useRestTimerStore();
      useEffect(() => store.getState().selectWorkout('active-outside-list', 90), [store]);
      return null;
    }
    const view = await render(
      <IntlProvider locale="en" messages={getMobileMessages('en')}>
        <RestTimerProvider
          accountId="user-1"
          defaultDuration={90}
          feedback={{ sound: false, vibration: false }}
        >
          <SeedWorkout />
          <WorkoutsScreen />
        </RestTimerProvider>
      </IntlProvider>,
    );
    await waitFor(() => expect(view.getByLabelText('Return to workout')).toBeTruthy());
    await fireEvent.press(view.getByTestId('workouts-filter-COMPLETED'));
    await fireEvent.press(view.getByTestId('active-workout-resume'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/workouts/[id]',
      params: { id: 'active-outside-list' },
    });
  });

  it('retains create, status filters and refresh without duplicate rows', async () => {
    const view = await screenFor('uk');
    expect(view.getByText('Мої тренування')).toBeTruthy();
    expect(view.getAllByText('Силове')).toHaveLength(1);

    await fireEvent.press(view.getByTestId('workouts-create'));
    expect(push).toHaveBeenCalledWith('/workouts/new');
    await fireEvent.press(view.getByTestId('workouts-programs'));
    expect(push).toHaveBeenCalledWith('/programs');
    await fireEvent.press(view.getByTestId('workouts-calendar'));
    expect(push).toHaveBeenCalledWith('/workouts/calendar');

    await fireEvent.press(view.getByTestId('workouts-filter-COMPLETED'));
    expect(useWorkoutsQuery).toHaveBeenCalledWith('COMPLETED');

    await fireEvent.press(view.getByTestId('workouts-refresh'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('guards creation and supports manual retry after a failed page', async () => {
    prepare('TRAINER', true);
    const view = await screenFor('uk');

    expect(view.queryByTestId('workouts-create')).toBeNull();
    expect(view.queryByTestId('workouts-programs')).toBeNull();
    expect(view.queryByTestId('workouts-calendar')).toBeNull();
    expect(view.getByText('Помилка завантаження. Спробувати ще')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('workouts-load-more'));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it('translates English status, filters, dates and accessible labels without rewriting workout titles', async () => {
    prepare('ATHLETE', false, {
      data: {
        pages: [
          {
            data: [
              {
                id: 'one',
                title: 'Жим лежачи',
                status: 'PLANNED',
                scheduledAt: '2026-11-21T10:00:00Z',
              },
              { id: 'two', title: 'День ніг', status: 'IN_PROGRESS', scheduledAt: null },
              { id: 'three', title: 'Присідання', status: 'COMPLETED', scheduledAt: null },
              { id: 'four', title: 'Станова тяга', status: 'CANCELLED', scheduledAt: null },
            ],
          },
        ],
      },
    });
    const view = await screenFor('en');
    expect(view.getByText('My workouts')).toBeTruthy();
    expect(view.getByText('Workout history and upcoming sessions')).toBeTruthy();
    expect(view.getByText('New workout')).toBeTruthy();
    expect(view.getByLabelText('Create workout')).toBeTruthy();
    for (const id of ['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) {
      expect(view.getByTestId(`workouts-filter-${id}`)).toBeTruthy();
    }
    expect(view.getAllByText('Planned').length).toBeGreaterThan(1);
    expect(view.getAllByText('In progress').length).toBeGreaterThan(1);
    expect(view.getAllByText('Completed').length).toBeGreaterThan(1);
    expect(view.getAllByText('Cancelled').length).toBeGreaterThan(1);
    expect(view.getByText('Nov 21, 2026')).toBeTruthy();
    expect(view.getByText('Жим лежачи')).toBeTruthy();
    expect(view.getByLabelText('Open workout Жим лежачи')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Open workout Жим лежачи'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/workouts/[id]',
      params: { id: 'one' },
    });
    expect(view.queryByText('Заплановано')).toBeNull();
  });

  it('preserves the selected status when switching locale', async () => {
    const view = await screenFor('en');
    await fireEvent.press(view.getByTestId('workouts-filter-COMPLETED'));
    expect(useWorkoutsQuery).toHaveBeenCalledWith('COMPLETED');
    await view.rerender(
      <IntlProvider locale="uk" defaultLocale="uk" messages={getMobileMessages('uk')}>
        <RestTimerProvider
          accountId={null}
          defaultDuration={90}
          feedback={{ sound: false, vibration: false }}
        >
          <WorkoutsScreen />
        </RestTimerProvider>
      </IntlProvider>,
    );
    expect(view.getByText('Мої тренування')).toBeTruthy();
    expect(view.getByTestId('workouts-filter-COMPLETED').props.accessibilityState.selected).toBe(
      true,
    );
    expect(useWorkoutsQuery).toHaveBeenCalledWith('COMPLETED');
  });

  it.each([
    [new MobileReadHttpError(429, 'SECRET_BACKEND_PAYLOAD'), 'Too many requests. Try again later.'],
    [
      new MobileReadHttpError(503, 'SECRET_BACKEND_PAYLOAD'),
      'The workout service is temporarily unavailable. Try again.',
    ],
    [new MobileAccessDeniedError(), 'You do not have permission to view these workouts.'],
    [new MobileSessionExpiredError(), 'Your session has expired. Sign in again.'],
    [new Error('SECRET_BACKEND_PAYLOAD'), 'Could not load your workouts. Try again.'],
  ])('shows safe localized error for %s', async (error, message) => {
    prepare('ATHLETE', false, { isError: true, isPending: false, error, data: undefined });
    const view = await screenFor('en');
    expect(view.getByText(message)).toBeTruthy();
    expect(view.queryByText('SECRET_BACKEND_PAYLOAD')).toBeNull();
  });

  it('translates loading, empty, page error and refresh actions without changing query behavior', async () => {
    prepare('ATHLETE', true, { isFetching: true, isFetchingNextPage: true, isPending: false });
    const view = await screenFor('en');
    expect(view.getByText('Loading next page…')).toBeTruthy();
    expect(view.getByText('Refreshing…')).toBeTruthy();
    expect(view.queryByText('Show more')).toBeNull();
    prepare('ATHLETE', false, { data: { pages: [] }, isPending: false, hasNextPage: false });
    await view.rerender(
      <IntlProvider locale="en" defaultLocale="uk" messages={getMobileMessages('en')}>
        <RestTimerProvider
          accountId={null}
          defaultDuration={90}
          feedback={{ sound: false, vibration: false }}
        >
          <WorkoutsScreen />
        </RestTimerProvider>
      </IntlProvider>,
    );
    expect(view.getByText('No workouts match this filter.')).toBeTruthy();
    expect(view.getByText('Refresh list')).toBeTruthy();
  });
});
