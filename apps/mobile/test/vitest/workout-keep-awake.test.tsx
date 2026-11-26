import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkoutKeepAwake } from '@/features/workouts/lib/use-workout-keep-awake';

const lock = vi.hoisted(() => ({
  focused: true,
  available: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock('expo-keep-awake', () => ({
  isAvailableAsync: lock.available,
  activateKeepAwakeAsync: lock.activate,
  deactivateKeepAwake: lock.deactivate,
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const focused = lock.focused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
}));

function Probe({ enabled = true }: { enabled?: boolean }) {
  useWorkoutKeepAwake(enabled);
  return null;
}

let change: ((status: AppStateStatus) => void) | undefined;
const remove = vi.fn();
let originalState: typeof AppState.currentState;

beforeEach(() => {
  originalState = AppState.currentState;
  AppState.currentState = 'active';
  lock.focused = true;
  lock.available.mockReset().mockResolvedValue(true);
  lock.activate.mockReset().mockResolvedValue(undefined);
  lock.deactivate.mockReset().mockResolvedValue(undefined);
  remove.mockClear();
  change = undefined;
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener as (status: AppStateStatus) => void;
    return { remove } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  await cleanup();
  AppState.currentState = originalState;
  vi.restoreAllMocks();
});

describe('workout screen wake lock', () => {
  it('releases on background, reacquires on return, and releases on blur', async () => {
    const view = await render(<Probe />);
    await waitFor(() => expect(lock.activate).toHaveBeenCalledTimes(1));
    const first = lock.activate.mock.calls[0]?.[0];
    await act(async () => change?.('background'));
    expect(lock.deactivate).toHaveBeenCalledWith(first);
    await act(async () => change?.('active'));
    await waitFor(() => expect(lock.activate).toHaveBeenCalledTimes(2));
    const second = lock.activate.mock.calls[1]?.[0];
    expect(second).not.toBe(first);
    lock.focused = false;
    await view.rerender(<Probe />);
    expect(lock.deactivate).toHaveBeenCalledWith(second);
    expect(remove).toHaveBeenCalled();
    expect(lock.deactivate).toHaveBeenCalledTimes(2);
  });

  it('releases a late acquisition after the workout becomes disabled', async () => {
    let finish!: () => void;
    lock.activate.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const view = await render(<Probe />);
    await waitFor(() => expect(lock.activate).toHaveBeenCalledTimes(1));
    const tag = lock.activate.mock.calls[0]?.[0];
    await view.rerender(<Probe enabled={false} />);
    await act(async () => finish());
    expect(lock.deactivate).toHaveBeenCalledExactlyOnceWith(tag);
  });

  it('does not activate when disabled, unfocused or unsupported', async () => {
    const view = await render(<Probe enabled={false} />);
    expect(lock.available).not.toHaveBeenCalled();
    lock.focused = false;
    await view.rerender(<Probe />);
    expect(lock.available).not.toHaveBeenCalled();
    lock.available.mockResolvedValue(false);
    lock.focused = true;
    await view.rerender(<Probe />);
    await waitFor(() => expect(lock.available).toHaveBeenCalledOnce());
    expect(lock.activate).not.toHaveBeenCalled();
  });

  it('waits for a confirmed active state when the initial state is undefined', async () => {
    AppState.currentState = undefined;
    const view = await render(<Probe />);
    expect(lock.available).not.toHaveBeenCalled();
    await act(async () => change?.('active'));
    await waitFor(() => expect(lock.activate).toHaveBeenCalledOnce());
    await view.unmount();
    expect(lock.deactivate).toHaveBeenCalledOnce();
  });

  it('does not acquire from background and ignores duplicate active events', async () => {
    AppState.currentState = 'background';
    const view = await render(<Probe />);
    expect(lock.available).not.toHaveBeenCalled();
    await act(async () => change?.('active'));
    await waitFor(() => expect(lock.activate).toHaveBeenCalledOnce());
    await act(async () => change?.('active'));
    expect(lock.activate).toHaveBeenCalledOnce();
    const tag = lock.activate.mock.calls[0]?.[0];
    await view.unmount();
    expect(lock.deactivate).toHaveBeenCalledExactlyOnceWith(tag);
  });
});
