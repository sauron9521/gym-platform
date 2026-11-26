import { createStore } from 'zustand/vanilla';

import { type RestDuration } from '@/shared/config/rest-duration';
import { secondsRemaining } from '../lib/rest-timer';

export type TimerScope = Readonly<{ workoutId: string }>;
type Countdown = {
  scope: TimerScope;
  duration: RestDuration;
  used: boolean;
  remaining: number;
  deadline: number | null;
};

type RestTimerState = {
  timer: Countdown | null;
  selectWorkout: (workoutId: string, duration: RestDuration) => void;
  clearWorkout: (workoutId: string) => void;
  syncDefault: (duration: RestDuration) => void;
  start: (scope: TimerScope, now: number) => void;
  toggle: (scope: TimerScope, now: number) => void;
  reset: (scope: TimerScope) => void;
  selectPreset: (scope: TimerScope, duration: RestDuration) => void;
  refresh: (now: number) => boolean;
};

/** Instance-local, ephemeral state. A scope object's identity rejects stale callbacks. */
export function createRestTimerStore(accountId: string | null) {
  return createStore<RestTimerState>()((set, get) => {
    const update = (scope: TimerScope, transform: (timer: Countdown) => Countdown) => {
      const timer = get().timer;
      if (timer?.scope !== scope) return;
      const next = transform(timer);
      if (next !== timer) set({ timer: next });
    };
    return {
      timer: null,
      selectWorkout: (workoutId, duration) => {
        if (!accountId || get().timer?.scope.workoutId === workoutId) return;
        set({
          timer: {
            scope: { workoutId },
            duration,
            used: false,
            remaining: duration,
            deadline: null,
          },
        });
      },
      clearWorkout: (workoutId) => {
        if (get().timer?.scope.workoutId === workoutId) set({ timer: null });
      },
      syncDefault: (duration) => {
        const timer = get().timer;
        if (timer && !timer.used && timer.duration !== duration) {
          set({ timer: { ...timer, duration, remaining: duration } });
        }
      },
      start: (scope, now) =>
        update(scope, (timer) => ({
          ...timer,
          used: true,
          remaining: timer.duration,
          deadline: now + timer.duration * 1000,
        })),
      toggle: (scope, now) =>
        update(scope, (timer) => {
          if (timer.deadline !== null) {
            return { ...timer, remaining: secondsRemaining(timer.deadline, now), deadline: null };
          }
          const remaining = timer.remaining > 0 ? timer.remaining : timer.duration;
          return { ...timer, used: true, remaining, deadline: now + remaining * 1000 };
        }),
      reset: (scope) =>
        update(scope, (timer) => ({ ...timer, remaining: timer.duration, deadline: null })),
      selectPreset: (scope, duration) =>
        update(scope, (timer) =>
          timer.deadline === null ? { ...timer, duration, remaining: duration, used: true } : timer,
        ),
      refresh: (now) => {
        const timer = get().timer;
        if (!timer || timer.deadline === null) return false;
        const remaining = secondsRemaining(timer.deadline, now);
        if (remaining === timer.remaining && remaining > 0) return false;
        set({ timer: { ...timer, remaining, deadline: remaining === 0 ? null : timer.deadline } });
        return remaining === 0;
      },
    };
  });
}

export type RestTimerStore = ReturnType<typeof createRestTimerStore>;
