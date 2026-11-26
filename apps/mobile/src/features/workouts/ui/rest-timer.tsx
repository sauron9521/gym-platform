import { useStore } from 'zustand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { restDurationPresets } from '@/shared/config/rest-duration';
import { createThemedStyles } from '@/shared/config/theme-provider';

import { formatRestTime } from '../lib/rest-timer';
import { useRestTimerStore } from '../model/rest-timer-provider';

export function RestTimer({ workoutId }: { workoutId: string }) {
  const styles = useStyles();
  const store = useRestTimerStore();
  const timer = useStore(store, (state) =>
    state.timer?.scope.workoutId === workoutId ? state.timer : null,
  );
  if (!timer) return null;
  const { scope } = timer;
  const { toggle, reset, selectPreset } = store.getState();

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
            onPress={() => selectPreset(scope, duration)}
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
          onPress={() => toggle(scope, Date.now())}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{running ? 'Пауза' : startLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Скинути"
          onPress={() => reset(scope)}
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
