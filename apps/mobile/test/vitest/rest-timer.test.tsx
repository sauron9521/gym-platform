import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { useStore } from 'zustand';
import { useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestTimer } from '@/features/workouts/ui/rest-timer';
import {
  RestTimerProvider,
  useRestTimerStore,
} from '@/features/workouts/model/rest-timer-provider';
import {
  createRestTimerStore,
  type RestTimerStore,
} from '@/features/workouts/model/rest-timer-store';
import { accountQueryKeys } from '@/shared/api/query-client';
import type { RestDuration } from '@/shared/config/rest-duration';

const notify = vi.hoisted(() => vi.fn());
vi.mock('@/features/workouts/lib/use-rest-feedback', () => ({ useRestFeedback: () => notify }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Options = {
  accountId?: string | null;
  workoutId?: string;
  visible?: boolean;
  duration?: RestDuration;
  feedback?: { sound: boolean; vibration: boolean };
  queryClient?: QueryClient;
};

function harness() {
  let store: RestTimerStore;
  function Screen({
    workoutId,
    duration,
    visible,
  }: {
    workoutId: string;
    duration: RestDuration;
    visible: boolean;
  }) {
    const instance = useRestTimerStore();
    store = instance;
    useEffect(() => {
      if (visible) instance.getState().selectWorkout(workoutId, duration);
    }, [instance, workoutId, duration, visible]);
    return visible ? <RestTimer workoutId={workoutId} /> : null;
  }
  const tree = ({
    accountId = 'athlete-a',
    workoutId = 'workout-a',
    visible = true,
    duration = 90,
    feedback = { sound: false, vibration: false },
    queryClient,
  }: Options = {}) => (
    <RestTimerProvider
      accountId={accountId}
      defaultDuration={duration}
      feedback={feedback}
      queryClient={queryClient}
    >
      <Screen workoutId={workoutId} duration={duration} visible={visible && Boolean(accountId)} />
    </RestTimerProvider>
  );
  return {
    tree,
    store: () => store!,
    start: () => {
      const state = store!.getState();
      if (state.timer) state.start(state.timer.scope, Date.now());
    },
  };
}

describe('RestTimer (native)', () => {
  it('offers presets, pause/resume and reset without feedback', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const h = harness();
    const view = await render(h.tree());
    expect(view.getByText('01:30')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '120 секунд' }));
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(view.getByRole('button', { name: '60 секунд', disabled: true })).toBeTruthy();
    clock.mockReturnValue(165000);
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('00:55')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Продовжити' }));
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Скинути' }));
    expect(view.getByText('02:00')).toBeTruthy();
    expect(notify).not.toHaveBeenCalled();
  });

  it('applies hydrated defaults before use but keeps a selected preset or active deadline', async () => {
    const h = harness();
    const view = await render(h.tree());
    await view.rerender(h.tree({ duration: 120 }));
    expect(view.getByText('02:00')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '60 секунд' }));
    await view.rerender(h.tree({ duration: 90 }));
    expect(view.getByText('01:00')).toBeTruthy();
    await act(async () => h.start());
    const deadline = h.store().getState().timer?.deadline;
    await view.rerender(h.tree({ duration: 120 }));
    expect(h.store().getState().timer?.deadline).toBe(deadline);
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
  });

  it('signals exactly one expiration when foregrounded, even without a timer screen', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    let change: ((status: AppStateStatus) => void) | undefined;
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      change = listener as (status: AppStateStatus) => void;
      return { remove: vi.fn() } as ReturnType<typeof AppState.addEventListener>;
    });
    const h = harness();
    const options = { duration: 60 as const, feedback: { sound: true, vibration: false } };
    const view = await render(h.tree(options));
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    await view.rerender(h.tree({ ...options, visible: false }));
    await act(async () => change?.('background'));
    clock.mockReturnValue(161000);
    await act(async () => change?.('active'));
    expect(notify).toHaveBeenCalledExactlyOnceWith(options.feedback, expect.any(Function));
    await act(async () => change?.('active'));
    await view.rerender(h.tree(options));
    expect(view.getByText('00:00')).toBeTruthy();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ticks in the runtime with no visible timer, uses current feedback and invalidates delayed signals', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const h = harness();
    const view = await render(h.tree({ duration: 60 }));
    await act(async () => h.start());
    await view.rerender(
      h.tree({ duration: 60, visible: false, feedback: { sound: true, vibration: false } }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59000);
    });
    expect(h.store().getState().timer?.remaining).toBe(1);
    expect(notify).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      { sound: true, vibration: false },
      expect.any(Function),
    );
    const isCurrent = notify.mock.calls[0]![1] as () => boolean;
    expect(isCurrent()).toBe(true);
    await act(async () => h.start());
    expect(isCurrent()).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(notify).toHaveBeenCalledTimes(2);
    const second = notify.mock.calls[1]![1] as () => boolean;
    await view.rerender(h.tree({ workoutId: 'workout-b', duration: 60 }));
    expect(second()).toBe(false);
    await view.unmount();
  });

  it('does not notify for reset, paused timer, or terminal cancellation even after the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const queryClient = new QueryClient();
    const h = harness();
    const view = await render(h.tree({ duration: 60, queryClient }));
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000);
    });
    expect(notify).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    await fireEvent.press(view.getByRole('button', { name: 'Скинути' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000);
    });
    expect(notify).not.toHaveBeenCalled();
    await act(async () => h.start());
    await act(async () => {
      queryClient.setQueryData(accountQueryKeys.workoutDetail('athlete-a', 'other'), {
        status: 'CANCELED',
      });
      queryClient.setQueryData(accountQueryKeys.workoutDetail('athlete-a', 'workout-a'), {
        status: 'IN_PROGRESS',
      });
    });
    expect(h.store().getState().timer?.deadline).not.toBeNull();
    await act(async () => {
      queryClient.setQueryData(accountQueryKeys.workoutDetail('athlete-a', 'workout-a'), {
        status: 'CANCELED',
      });
      await vi.advanceTimersByTimeAsync(61000);
    });
    expect(h.store().getState().timer).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    await view.unmount();
    queryClient.clear();
  });

  it('preserves the deadline across screen removal and remount, then restarts on a new confirmed event', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const h = harness();
    const view = await render(h.tree({ duration: 60 }));
    await act(async () => h.start());
    await view.rerender(h.tree({ duration: 60, visible: false }));
    clock.mockReturnValue(110000);
    await act(async () => {
      h.store().getState().refresh(Date.now());
    });
    await view.rerender(h.tree({ duration: 60 }));
    expect(view.getByText('00:50')).toBeTruthy();
    await act(async () => h.start());
    expect(view.getByText('01:00')).toBeTruthy();
  });

  it('isolates account changes and rejects a stale workout scope', async () => {
    const h = harness();
    const view = await render(h.tree());
    const oldStore = h.store();
    const oldScope = oldStore.getState().timer!.scope;
    await act(async () => h.start());
    await view.rerender(h.tree({ workoutId: 'workout-b' }));
    await act(async () => oldStore.getState().start(oldScope, Date.now()));
    expect(view.getByRole('button', { name: 'Старт' })).toBeTruthy();
    await view.rerender(h.tree({ accountId: null }));
    expect(oldStore.getState().timer).toBeNull();
    await view.rerender(h.tree({ accountId: 'athlete-b' }));
    expect(h.store()).not.toBe(oldStore);
    expect(view.getByRole('button', { name: 'Старт' })).toBeTruthy();
  });

  it('clears the timer on authoritative terminal cache update while the screen is absent', async () => {
    const h = harness();
    const queryClient = new QueryClient();
    const view = await render(h.tree({ queryClient }));
    await act(async () => h.start());
    await view.rerender(h.tree({ queryClient, visible: false }));
    await act(async () => {
      queryClient.setQueryData(accountQueryKeys.workoutDetail('athlete-b', 'workout-a'), {
        status: 'COMPLETED',
      });
    });
    expect(h.store().getState().timer).not.toBeNull();
    await act(async () => {
      queryClient.setQueryData(accountQueryKeys.workoutDetail('athlete-a', 'workout-a'), {
        status: 'COMPLETED',
      });
    });
    await waitFor(() => expect(h.store().getState().timer).toBeNull());
  });
});

describe('rest timer store', () => {
  it('isolates providers and keeps scope-only subscribers stable across countdown ticks', async () => {
    const store = createRestTimerStore('athlete-a');
    const other = createRestTimerStore('athlete-a');
    const signedOut = createRestTimerStore(null);
    signedOut.getState().selectWorkout('a', 60);
    expect(signedOut.getState().timer).toBeNull();
    store.getState().selectWorkout('a', 60);
    const scope = store.getState().timer!.scope;
    const scopeRender = vi.fn();
    const countdownRender = vi.fn();
    function Probe() {
      const selected = useStore(store, (state) => state.timer?.scope);
      scopeRender();
      return <Text>{selected?.workoutId}</Text>;
    }
    function CountdownProbe() {
      const remaining = useStore(store, (state) => state.timer?.remaining);
      countdownRender();
      return <Text>{remaining}</Text>;
    }
    const view = await render(
      <>
        <Probe />
        <CountdownProbe />
      </>,
    );
    await act(async () => store.getState().start(scope, 100000));
    const scopeCount = scopeRender.mock.calls.length;
    const countdownCount = countdownRender.mock.calls.length;
    await act(async () => {
      store.getState().refresh(101000);
    });
    expect(view.getByText('59')).toBeTruthy();
    expect(scopeRender).toHaveBeenCalledTimes(scopeCount);
    expect(countdownRender.mock.calls.length).toBeGreaterThan(countdownCount);
    expect(other.getState().timer).toBeNull();
    await view.unmount();
  });

  it('rejects stale callbacks even when returning to the same workout ID', () => {
    const store = createRestTimerStore('athlete-a');
    store.getState().selectWorkout('a', 60);
    const old = store.getState().timer!.scope;
    store.getState().selectWorkout('b', 90);
    store.getState().selectWorkout('a', 120);
    store.getState().start(old, 100000);
    expect(store.getState().timer?.deadline).toBeNull();
    expect(store.getState().timer?.duration).toBe(120);
  });
  it('restarts a full preset after an elapsed deadline and consumes expiration once', () => {
    const store = createRestTimerStore('athlete-a');
    store.getState().selectWorkout('a', 60);
    const scope = store.getState().timer!.scope;
    store.getState().start(scope, 100000);
    expect(store.getState().refresh(161000)).toBe(true);
    expect(store.getState().refresh(161000)).toBe(false);
    store.getState().toggle(scope, 162000);
    expect(store.getState().timer?.remaining).toBe(60);
    expect(store.getState().timer?.deadline).toBe(222000);
  });
});
