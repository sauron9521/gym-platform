import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
  type WorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { palette } from '@/shared/config/theme';
import { WorkoutSetRow } from './workout-set-row';
import { RestTimer } from '@/features/workouts/ui/rest-timer';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';

// Preserve the compact native status-action state machine for focused review.
// prettier-ignore
export function WorkoutDetailsScreen({ id }: { id: string }) {
  const details = useWorkoutDetailsQuery(id);
  const transition = useWorkoutTransition(id);
  const workout = details.data;
  const titleUpdate = useUpdateWorkoutTitle(id);
  const cancel = useCancelWorkout(id);
  const [editedTitle, setEditedTitle] = useState('');
  useEffect(() => { if (workout?.title) setEditedTitle(workout.title); }, [workout?.title]);
  const confirmCancel = () => Alert.alert('Скасувати тренування?', 'Цю дію не можна скасувати.', [
    { text: 'Назад', style: 'cancel' },
    { text: 'Скасувати тренування', style: 'destructive', onPress: () => cancel.mutate() },
  ]);
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
              {exercise.sets.map((set) => (
                <WorkoutSetRow
                  key={set.id}
                  workoutId={id}
                  set={set}
                  editable={workout.status === 'IN_PROGRESS'}
                />
              ))}
            </View>
          ))}
          {workout.status === 'PLANNED' ? (
            <View style={styles.editor}>
              <TextInput
                accessibilityLabel="Нова назва тренування"
                value={editedTitle}
                onChangeText={setEditedTitle}
                editable={!titleUpdate.isPending}
                style={styles.titleInput}
              />
              <Pressable accessibilityRole="button" disabled={titleUpdate.isPending || editedTitle.trim() === workout.title} style={styles.button} onPress={() => titleUpdate.mutate(editedTitle)}>
                <Text style={styles.buttonText}>Зберегти назву</Text>
              </Pressable>
              {titleUpdate.isError ? <Text style={styles.error}>{titleUpdate.error.message}</Text> : null}
            </View>
          ) : null}
          {workout.status === 'IN_PROGRESS' ? <RestTimer /> : null}
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
          {(workout.status === 'PLANNED' || workout.status === 'IN_PROGRESS') ? (
            <Pressable accessibilityRole="button" disabled={cancel.isPending} onPress={confirmCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Скасувати тренування</Text>
            </Pressable>
          ) : null}
          {cancel.isError ? <Text accessibilityRole="alert" style={styles.error}>{cancel.error.message}</Text> : null}
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
  editor: { gap: 10 },
  titleInput: { color: palette.text, padding: 12, borderRadius: 10, borderColor: palette.border, borderWidth: 1, minHeight: 48 },
  cancelButton: { borderColor: palette.border, borderWidth: 1, padding: 15, borderRadius: 10, alignItems: 'center', minHeight: 48 },
  cancelText: { color: '#ff6460', fontWeight: '600' },
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
