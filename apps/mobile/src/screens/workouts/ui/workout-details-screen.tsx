import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { workoutTitleError } from '@/features/workouts/lib/workout-edit-policy';
import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import { RestTimer } from '@/features/workouts/ui/rest-timer';
import { useWorkoutDetails } from '../model/use-workout-details';
import { createThemedStyles } from '@/shared/config/theme-provider';
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
  const styles = useStyles();
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

// prettier-ignore
export function WorkoutDetailsScreen({ id }: { id: string }) {
  const styles = useStyles();
  const {
    details, transition, titleUpdate, cancellation, workout,
    progress, total, processed, percent, completionAllowed, reconciling,
    busy, pendingSet, uncertain, restStart, restDuration, restFeedback, nextAction, actionDisabled,
    saveTitle, confirmCancellation, runTransition, isSetActionBlocked,
    beginSetWrite, settleSetWrite, startRest,
  } = useWorkoutDetails(id);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      alwaysBounceVertical={false}
      testID="workout-details-scroll"
    >
      {details.isPending ? <ActivityIndicator accessibilityLabel="Завантаження" /> : null}
      {reconciling ? (
        <Text accessibilityLiveRegion="polite" testID="workout-reconciling" style={styles.muted}>
          Перевіряємо актуальний стан підходів…
        </Text>
      ) : null}
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
          {workout.status === 'IN_PROGRESS' ? (
            <>
              <Text accessibilityRole="summary" style={styles.muted}>
                Підходи: {progress.completed} виконано, {progress.skipped} пропущено, {progress.pending} очікують
              </Text>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Опрацьовано підходів"
                accessibilityValue={{ min: 0, max: 100, now: percent }}
                testID="workout-set-progress"
                style={styles.progressTrack}
              >
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.muted}>Опрацьовано: {processed} / {total} · {percent}%</Text>
              {pendingSet !== null || uncertain ? (
                <Text accessibilityLiveRegion="polite" testID="workout-write-blocked" style={styles.muted}>
                  {uncertain ? 'Потрібна перевірка стану підходу із сервера.' : 'Дочекайтеся збереження підходу.'}
                </Text>
              ) : null}
              {uncertain ? (
                <Pressable
                  accessibilityRole="button"
                  testID="workout-verify-sets"
                  disabled={reconciling}
                  accessibilityState={{ disabled: reconciling, busy: reconciling }}
                  onPress={() => void details.refetch()}
                  style={styles.cancelButton}
                >
                  <Text style={styles.muted}>Перевірити стан із сервера</Text>
                </Pressable>
              ) : null}
              {!completionAllowed ? (
                <Text style={styles.muted}>
                  Для завершення потрібен хоча б один виконаний підхід і жодного незавершеного.
                </Text>
              ) : null}
              <RestTimer key={id} autoStart={restStart} defaultDuration={restDuration} feedback={restFeedback} />
            </>
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
                  reconciling={reconciling}
                  actionBlocked={isSetActionBlocked(set.id)}
                  onWriteStart={beginSetWrite}
                  onWriteSettled={settleSetWrite}
                  onNewCompletion={startRest}
                  canonicalSnapshotAt={details.dataUpdatedAt}
                  canonicalReadVersion={details.canonicalReadVersion}
                />
              ))}
            </View>
          ))}
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
              disabled={actionDisabled}
              accessibilityState={{ disabled: actionDisabled }}
              onPress={runTransition}
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

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 16 },
    title: { fontSize: 26, fontWeight: '700', color: palette.text },
    heading: { fontSize: 17, fontWeight: '600', color: palette.text },
    muted: { fontSize: 14, color: palette.muted },
    error: { fontSize: 14, color: palette.error },
    progressTrack: {
      height: 8,
      backgroundColor: palette.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 4 },
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
    cancelText: { color: palette.error, fontWeight: '600' },
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
    buttonText: { fontWeight: '700', color: palette.primaryForeground },
  }),
);
