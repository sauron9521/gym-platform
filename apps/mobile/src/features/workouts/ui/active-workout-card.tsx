import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { createThemedStyles } from '@/shared/config/theme-provider';
import { formatRestTime } from '../lib/rest-timer';
import { useRestTimerStore } from '../model/rest-timer-provider';

/** A local continuation shortcut, not a server-wide active workout search. */
export function ActiveWorkoutCard() {
  const styles = useStyles();
  const router = useRouter();
  const intl = useIntl();
  const store = useRestTimerStore();
  const scope = useStore(store, (state) => state.timer?.scope ?? null);
  if (!scope) return null;

  return (
    <Pressable
      testID="active-workout-resume"
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage({ id: 'mobile.activeWorkout.resume' })}
      style={styles.card}
      onPress={() => {
        if (store.getState().timer?.scope !== scope) return;
        router.push({ pathname: '/workouts/[id]', params: { id: scope.workoutId } });
      }}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {intl.formatMessage({ id: 'mobile.activeWorkout.resume' })}
        </Text>
        <Text style={styles.hint}>{intl.formatMessage({ id: 'mobile.activeWorkout.hint' })}</Text>
      </View>
      <CompactRestCountdown workoutId={scope.workoutId} />
    </Pressable>
  );
}

function CompactRestCountdown({ workoutId }: { workoutId: string }) {
  const styles = useStyles();
  const intl = useIntl();
  const store = useRestTimerStore();
  const timer = useStore(store, (state) =>
    state.timer?.scope.workoutId === workoutId ? state.timer : null,
  );
  if (!timer) return null;
  const running = timer.deadline !== null;
  const paused = timer.remaining > 0 && timer.remaining < timer.duration && !running;
  if (!running && !paused) return null;

  const time = formatRestTime(timer.remaining);
  const label = intl.formatMessage({
    id: paused ? 'mobile.activeWorkout.paused' : 'mobile.activeWorkout.rest',
  });
  return (
    <View style={styles.countdown} testID="active-workout-countdown">
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    card: {
      borderColor: palette.primary,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: palette.surface,
      padding: 14,
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    content: { flex: 1, gap: 4 },
    title: { color: palette.primary, fontWeight: '700', fontSize: 16 },
    hint: { color: palette.muted, fontSize: 12 },
    countdown: { alignItems: 'flex-end', gap: 4 },
    time: {
      color: palette.primary,
      fontSize: 22,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  }),
);
