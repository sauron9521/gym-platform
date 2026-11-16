import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
  type WorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { palette } from '@/shared/config/theme';

export function WorkoutDetailsScreen({ id }: { id: string }) {
  const details = useWorkoutDetailsQuery(id);
  const transition = useWorkoutTransition(id);
  const workout = details.data;
  const nextAction: WorkoutTransition | null =
    workout?.status === 'PLANNED'
      ? 'start'
      : workout?.status === 'IN_PROGRESS'
        ? 'complete'
        : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {details.isPending ? <ActivityIndicator accessibilityLabel="Завантаження" /> : null}
      {details.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {details.error.message}
        </Text>
      ) : null}

      {workout && !details.isError ? (
        <>
          <Text style={styles.title}>{workout.title}</Text>
          <Text style={styles.muted}>{workoutStatusLabel(workout.status)}</Text>
          {workout.notes ? <Text style={styles.muted}>{workout.notes}</Text> : null}
          {workout.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.card}>
              <Text style={styles.heading}>{exercise.exerciseNameSnapshot}</Text>
              <Text style={styles.muted}>Підходів: {exercise.sets.length}</Text>
            </View>
          ))}
          {nextAction ? (
            <Pressable
              accessibilityRole="button"
              testID="workout-status-action"
              style={styles.button}
              disabled={transition.isPending}
              onPress={() => transition.mutate(nextAction)}
            >
              <Text style={styles.buttonText}>
                {transition.isPending
                  ? 'Зберігаємо…'
                  : nextAction === 'start'
                    ? 'Почати тренування'
                    : 'Завершити тренування'}
              </Text>
            </Pressable>
          ) : null}
          {transition.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {transition.error.message}
            </Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: palette.text },
  heading: { fontSize: 17, fontWeight: '600', color: palette.text },
  muted: { fontSize: 14, color: palette.muted },
  error: { fontSize: 14, color: '#b91c1c' },
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 18,
    gap: 8,
  },
  button: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700', color: palette.surface },
});
