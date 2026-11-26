import { useCallback, useId, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake, isAvailableAsync } from 'expo-keep-awake';

/** A focused, active workout owns only its own wake-lock tag. */
export function useWorkoutKeepAwake(enabled: boolean) {
  const owner = useId();
  const sequence = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let live = true;
      let stop: (() => void) | null = null;

      const sync = (state: typeof AppState.currentState) => {
        if (state !== 'active') {
          stop?.();
          stop = null;
          return;
        }
        if (!live || stop) return;
        const tag = `ovranto-workout:${owner}:${++sequence.current}`;
        let cancelled = false;
        let acquired = false;
        const release = async () => {
          try {
            await deactivateKeepAwake(tag);
          } catch {
            // The OS may already have released the lock.
          }
        };
        stop = () => {
          cancelled = true;
          if (acquired) void release();
        };
        void (async () => {
          try {
            if (!(await isAvailableAsync()) || cancelled) return;
            await activateKeepAwakeAsync(tag);
            acquired = true;
            // A slow native acquisition can finish after blur or background.
            if (cancelled) await release();
          } catch {
            // Unsupported devices and transient native errors must not block training.
          }
        })();
      };
      const subscription = AppState.addEventListener('change', sync);
      sync(AppState.currentState);
      return () => {
        live = false;
        subscription.remove();
        stop?.();
        stop = null;
      };
    }, [enabled, owner]),
  );
}
