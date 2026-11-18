import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { workoutTitleError } from '@/features/workouts/lib/workout-edit-policy';
import { useCancelWorkout, useUpdateWorkoutTitle } from '@/features/workouts/model/workout-edit';
import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import { RestTimer } from '@/features/workouts/ui/rest-timer';
import {
  useWorkoutDetailsQuery,
  useWorkoutTransition,
  type WorkoutTransition,
} from '@/features/workouts/model/workout-details-query';
import { palette } from '@/shared/config/theme';
import { WorkoutSetRow } from './workout-set-row';

type TitleEditorProps = {
  title: string;
  disabled: boolean;
  pending: boolean;
  failure: string | null;
  onSave: (title: string) => void;
};

/** Keyed by the server title, so successful PATCH resets the local input. */
// prettier-ignore
function WorkoutTitleEditor({ title, disabled, pending, failure, onSave }: TitleEditorProps) {
  const [editedTitle, setEditedTitle] = useState(title);
  const normalized = editedTitle.trim();
  const error = workoutTitleError(editedTitle);
  const saveDisabled = disabled || Boolean(error) || normalized === title;

  return (
    <View style={styles.editor}>
      <TextInput
        accessibilityLabel="Нова назва тренування"
        testID="workout-title-edit"
        value={editedTitle}
        onChangeText={setEditedTitle}
        maxLength={120}
        editable={!disabled}
        style={styles.titleInput}
      />
      {error && normalized !== title ? (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Зберегти назву"
        accessibilityState={{ disabled: saveDisabled }}
        disabled={saveDisabled}
        style={styles.button}
        onPress={() => onSave(normalized)}
      >
        <Text style={styles.buttonText}>{pending ? 'Зберігаємо…' : 'Зберегти назву'}</Text>
      </Pressable>
      {failure ? (
        <Text accessibilityRole="alert" style={styles.error}>{failure}</Text>
      ) : null}
    </View>
  );
}

// Preserve the compact native status-action state machine for focused review.
// prettier-ignore
export function WorkoutDetailsScreen({ id }: { id: string }) {
  const details = useWorkoutDetailsQuery(id);
  const transition = useWorkoutTransition(id);
  const titleUpdate = useUpdateWorkoutTitle(id);
  const cancellation = useCancelWorkout(id);
  const writeLock = useRef(false);
  const workout = details.data;
  const busy = transition.isPending || titleUpdate.isPending || cancellation.isPending;
  const cancellable = workout?.status === 'PLANNED' || workout?.status === 'IN_PROGRESS';
  const releaseLock = () => { writeLock.current = false; };

  const saveTitle = (title: string) => {
    if (writeLock.current || busy || workout?.status !== 'PLANNED') return;
    writeLock.current = true;
    titleUpdate.mutate(title, { onSettled: releaseLock });
  };

  const confirmCancellation = () => {
    if (writeLock.current || busy || !cancellable) return;
    writeLock.current = true;
    Alert.alert(
      'Скасувати тренування?',
      'Цю дію не можна скасувати.',
      [
        {
          text: 'Назад',
          style: 'cancel',
          onPress: releaseLock,
        },
        {
          text: 'Скасувати тренування',
          style: 'destructive',
          onPress: () => {
            cancellation.mutate(undefined, {
              onSettled: releaseLock,
            });
          },
        },
      ],
      { cancelable: false },
    );
  };
  const nextAction: WorkoutTransition | null =
    workout?.status === 'PLANNED'
      ? 'start'
      : workout?.status === 'IN_PROGRESS'
        ? 'complete'
        : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical={false}
      testID="workout-details-scroll"
    >
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
          {workout.status === 'PLANNED' ? (
            <WorkoutTitleEditor
              key={`${id}:${workout.title}`}
              title={workout.title}
              disabled={busy}
              pending={titleUpdate.isPending}
              failure={titleUpdate.isError ? titleUpdate.error.message : null}
              onSave={saveTitle}
            />
          ) : null}
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
          {workout.status === 'IN_PROGRESS' ? <RestTimer key={id} /> : null}
          {workout.status === 'PLANNED' || workout.status === 'IN_PROGRESS' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Скасувати тренування"
              accessibilityState={{ disabled: busy }}
              testID="workout-cancel"
              disabled={busy}
              onPress={confirmCancellation}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Скасувати тренування</Text>
            </Pressable>
          ) : null}
          {cancellation.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {cancellation.error.message}
            </Text>
          ) : null}
          {nextAction ? (
            <Pressable
              accessibilityRole="button"
              testID="workout-status-action"
              style={styles.button}
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={() => {
                if (writeLock.current || busy) return;
                transition.mutate(nextAction);
              }}
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
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 64, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: palette.text },
  heading: { fontSize: 17, fontWeight: '600', color: palette.text },
  muted: { fontSize: 14, color: palette.muted },
  error: { fontSize: 14, color: '#b91c1c' },
  editor: { gap: 10 },
  titleInput: {
    color: palette.text,
    padding: 12,
    borderRadius: 10,
    borderColor: palette.border,
    borderWidth: 1,
    minHeight: 48,
  },
  cancelButton: {
    borderColor: palette.border,
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
  },
  cancelText: { color: '#ff6460', fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 18,
    gap: 8,
    minWidth: 0,
  },
  button: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700', color: palette.surface },
});
