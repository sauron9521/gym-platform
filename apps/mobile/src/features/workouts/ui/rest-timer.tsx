import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';

import { formatRestTime, secondsRemaining } from '../lib/rest-timer';

type Countdown = {
  duration: number;
  remaining: number;
  deadline: number | null;
};

const PRESETS = [60, 90, 120] as const;

/**
 * Client-only rest timer. The absolute deadline preserves elapsed time while
 * React Native pauses JS intervals in the background. It is not persisted
 * across process termination and never writes to the API.
 */
export function RestTimer() {
  const [timer, setTimer] = useState<Countdown>({
    duration: 90,
    remaining: 90,
    deadline: null,
  });
  const [foreground, setForeground] = useState(true);

  const refresh = useCallback(() => {
    setTimer((current) => {
      if (current.deadline === null) return current;
      const remaining = secondsRemaining(current.deadline, Date.now());
      if (remaining === current.remaining && remaining > 0) return current;
      return {
        ...current,
        remaining,
        deadline: remaining === 0 ? null : current.deadline,
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
    refresh();
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

  const selectPreset = (duration: number) => {
    setTimer((current) => {
      if (current.deadline !== null) return current;
      return { duration, remaining: duration, deadline: null };
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
        {PRESETS.map((duration) => (
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

const styles = StyleSheet.create({
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
  buttonText: { color: palette.background, fontWeight: '700' },
});
