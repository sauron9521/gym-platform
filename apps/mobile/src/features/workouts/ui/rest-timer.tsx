import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  defaultRestDuration,
  restDurationPresets,
  type RestDuration,
} from '@/shared/config/rest-duration';
import { createThemedStyles } from '@/shared/config/theme-provider';

import { useRestFeedback, type RestFeedback } from '../lib/use-rest-feedback';
import { formatRestTime, secondsRemaining } from '../lib/rest-timer';

type Countdown = {
  duration: RestDuration;
  used: boolean;
  remaining: number;
  deadline: number | null;
  completion: number;
};

/**
 * Client-only rest timer. The absolute deadline preserves elapsed time while
 * React Native pauses JS intervals in the background. It is not persisted
 * across process termination and never writes to the API.
 */
export type RestStart = { sequence: number; startedAt: number };

export function RestTimer({
  autoStart,
  defaultDuration = defaultRestDuration,
  feedback = { sound: false, vibration: false },
}: { autoStart?: RestStart | null; defaultDuration?: RestDuration; feedback?: RestFeedback } = {}) {
  const styles = useStyles();
  const [timer, setTimer] = useState<Countdown>({
    duration: defaultDuration,
    remaining: defaultDuration,
    used: false,
    deadline: null,
    completion: 0,
  });
  // Hydration may finish after the screen mounts. Never reset a timer that
  // has already been started or customized in this workout.
  if (!timer.used && timer.duration !== defaultDuration) {
    setTimer({ ...timer, duration: defaultDuration, remaining: defaultDuration });
  }
  const [foreground, setForeground] = useState(true);
  const consumed = useRef<number | null>(null);
  const signaled = useRef(0);
  const notify = useRestFeedback();

  useEffect(() => {
    if (!foreground || timer.completion <= signaled.current) return;
    signaled.current = timer.completion;
    notify(feedback);
  }, [foreground, timer.completion, feedback, notify]);

  useEffect(() => {
    if (!autoStart || consumed.current === autoStart.sequence) return;
    consumed.current = autoStart.sequence;
    setTimer((current) => {
      const deadline = autoStart.startedAt + current.duration * 1000;
      const remaining = secondsRemaining(deadline, Date.now());
      return { ...current, used: true, remaining, deadline: remaining > 0 ? deadline : null };
    });
  }, [autoStart]);

  const refresh = useCallback(() => {
    setTimer((current) => {
      if (current.deadline === null) return current;
      const remaining = secondsRemaining(current.deadline, Date.now());
      if (remaining === current.remaining && remaining > 0) return current;
      return {
        ...current,
        remaining,
        deadline: remaining === 0 ? null : current.deadline,
        completion: current.completion + (remaining === 0 ? 1 : 0),
      };
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!foreground || timer.deadline === null) return;
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [foreground, refresh, timer.deadline]);

  const toggle = () => {
    setTimer((current) => {
      if (current.deadline !== null) {
        return {
          ...current,
          remaining: secondsRemaining(current.deadline, Date.now()),
          deadline: null,
        };
      }
      const remaining = current.remaining > 0 ? current.remaining : current.duration;
      return {
        ...current,
        remaining,
        used: true,
        deadline: Date.now() + remaining * 1000,
      };
    });
  };

  const reset = () => {
    setTimer((current) => ({
      ...current,
      remaining: current.duration,
      deadline: null,
    }));
  };

  const selectPreset = (duration: RestDuration) => {
    setTimer((current) => {
      if (current.deadline !== null) return current;
      return { ...current, duration, remaining: duration, deadline: null, used: true };
    });
  };

  const running = timer.deadline !== null;
  const canResume = timer.remaining > 0 && timer.remaining < timer.duration;
  const startLabel = canResume ? 'Продовжити' : 'Старт';
  const remainingText = formatRestTime(timer.remaining);

  return (
    <View style={styles.container} accessibilityLabel="Таймер відпочинку">
      <Text style={styles.heading}>Відпочинок між підходами</Text>
      <Text style={styles.time} accessibilityLabel={`Залишилось ${remainingText}`}>
        {remainingText}
      </Text>
      <View style={styles.actions}>
        {restDurationPresets.map((duration) => (
          <Pressable
            key={duration}
            accessibilityRole="button"
            accessibilityLabel={`${duration} секунд`}
            accessibilityState={{ selected: timer.duration === duration, disabled: running }}
            disabled={running}
            onPress={() => selectPreset(duration)}
            style={styles.choice}
          >
            <Text style={styles.text}>{duration} с</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? 'Пауза' : startLabel}
          onPress={toggle}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{running ? 'Пауза' : startLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Скинути"
          onPress={reset}
          style={styles.choice}
        >
          <Text style={styles.text}>Скинути</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderColor: palette.border,
      borderWidth: 1,
      padding: 14,
      gap: 10,
    },
    heading: { color: palette.text, fontWeight: '600' },
    time: { color: palette.primary, fontSize: 30, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    choice: {
      borderWidth: 1,
      borderColor: palette.border,
      padding: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 8,
    },
    text: { color: palette.text },
    button: {
      backgroundColor: palette.primary,
      padding: 10,
      borderRadius: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    buttonText: { color: palette.primaryForeground, fontWeight: '700' },
  }),
);
