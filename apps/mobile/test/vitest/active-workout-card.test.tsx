import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RestTimerProvider,
  useRestTimerStore,
} from '@/features/workouts/model/rest-timer-provider';
import type { RestTimerStore } from '@/features/workouts/model/rest-timer-store';
import { ActiveWorkoutCard } from '@/features/workouts/ui/active-workout-card';
import { RestTimer } from '@/features/workouts/ui/rest-timer';
import { accountQueryKeys } from '@/shared/api/query-client';
import { getMobileMessages } from '@/shared/i18n/mobile-messages';
import { MobileAccessDeniedError } from '@/shared/api/api-error-policy';

const push = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/workouts/lib/use-rest-feedback', () => ({ useRestFeedback: () => notify }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function harness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let store!: RestTimerStore;
  function Capture() {
    const current = useRestTimerStore();
    useEffect(() => {
      store = current;
    }, [current]);
    return null;
  }
  const tree = (accountId: string | null = 'athlete-a', showDetails = false) => (
    <IntlProvider locale="en" messages={getMobileMessages('en')}>
      <RestTimerProvider
        accountId={accountId}
        defaultDuration={90}
        feedback={{ sound: false, vibration: false }}
        queryClient={queryClient}
      >
        <Capture />
        {showDetails ? <RestTimer workoutId="workout-a" /> : <ActiveWorkoutCard />}
      </RestTimerProvider>
    </IntlProvider>
  );
  return { tree, queryClient, store: () => store };
}

describe('Active workout continuation', () => {
  it('shares the exact countdown with the details screen and navigates to the scoped workout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const h = harness();
    const view = await render(h.tree());
    expect(view.queryByTestId('active-workout-resume')).toBeNull();
    await act(async () => h.store().getState().selectWorkout('workout-a', 90));
    expect(view.getByLabelText('Return to workout')).toBeTruthy();
    expect(view.queryByTestId('active-workout-countdown')).toBeNull();
    await view.rerender(h.tree('athlete-a', true));
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(view.getByText('01:20')).toBeTruthy();
    await view.rerender(h.tree());
    expect(view.getByText('01:20')).toBeTruthy();
    await fireEvent.press(view.getByTestId('active-workout-resume'));
    expect(push).toHaveBeenCalledExactlyOnceWith({
      pathname: '/workouts/[id]',
      params: { id: 'workout-a' },
    });
    await view.rerender(h.tree('athlete-a', true));
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    await view.rerender(h.tree());
    expect(view.getByText('Paused')).toBeTruthy();
    expect(view.getByText('01:20')).toBeTruthy();
    await view.rerender(h.tree(null));
    expect(view.queryByTestId('active-workout-resume')).toBeNull();
    await view.rerender(h.tree('athlete-b'));
    expect(view.queryByTestId('active-workout-resume')).toBeNull();
    await view.unmount();
    h.queryClient.clear();
  });

  it('clears only on matching terminal list evidence, not missing rows or another account', async () => {
    const h = harness();
    const view = await render(h.tree());
    await act(async () => h.store().getState().selectWorkout('workout-a', 90));
    const list = (id: string, status: string) => ({
      pages: [{ data: [{ id, status }] }],
      pageParams: [1],
    });
    await act(async () => {
      h.queryClient.setQueryData(
        [...accountQueryKeys.workouts('athlete-b'), 'ALL'],
        list('workout-a', 'COMPLETED'),
      );
      h.queryClient.setQueryData(
        [...accountQueryKeys.workouts('athlete-a'), 'COMPLETED'],
        list('other', 'COMPLETED'),
      );
      h.queryClient.setQueryData(
        [...accountQueryKeys.workouts('athlete-a'), 'ALL'],
        list('workout-a', 'PLANNED'),
      );
    });
    expect(view.getByTestId('active-workout-resume')).toBeTruthy();
    await act(async () => {
      h.queryClient.setQueryData(
        [...accountQueryKeys.workouts('athlete-a'), 'ALL'],
        list('workout-a', 'CANCELLED'),
      );
    });
    expect(view.queryByTestId('active-workout-resume')).toBeNull();
    await view.unmount();
    h.queryClient.clear();
  });

  it('retains a shortcut on transient read error but clears it when access is denied', async () => {
    const h = harness();
    const view = await render(h.tree());
    await act(async () => h.store().getState().selectWorkout('workout-a', 90));
    const key = accountQueryKeys.workoutDetail('athlete-a', 'workout-a');
    await act(async () => {
      await h.queryClient
        .fetchQuery({
          queryKey: key,
          queryFn: async () => {
            throw new Error('offline');
          },
        })
        .catch(() => undefined);
    });
    expect(view.getByTestId('active-workout-resume')).toBeTruthy();
    await act(async () => {
      await h.queryClient
        .fetchQuery({
          queryKey: key,
          queryFn: async () => {
            throw new MobileAccessDeniedError();
          },
        })
        .catch(() => undefined);
    });
    expect(view.queryByTestId('active-workout-resume')).toBeNull();
    await view.unmount();
    h.queryClient.clear();
  });
});
