import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  workoutSetFormSchema,
  workoutSetPayload,
  type WorkoutSetFormValues,
} from '@/features/workouts/lib/workout-set-form';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';
import {
  WorkoutSetRateLimitError,
  WorkoutSetOutcomeUnknownError,
  useWorkoutSetMutation,
} from '@/features/workouts/model/workout-set-mutation';
import { palette } from '@/shared/config/theme';

type WorkoutSet = WorkoutDetails['exercises'][number]['sets'][number];

export function WorkoutSetRow({
  workoutId,
  set,
  editable,
  reconciling = false,
  canonicalSnapshotAt,
  canonicalReadVersion = 0,
}: {
  workoutId: string;
  set: WorkoutSet;
  editable: boolean;
  reconciling?: boolean;
  canonicalSnapshotAt?: number;
  canonicalReadVersion?: number;
}) {
  const mutation = useWorkoutSetMutation(workoutId);
  const submitLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  // A lost response must not unlock another PATCH before a later canonical GET.
  const [unverifiedReadVersion, setUnverifiedReadVersion] = useState<number | null>(null);
  // A PATCH response is authoritative even if the details query has no cache yet.
  // Once a newer server snapshot arrives, use it instead of the local acknowledgment.
  const [confirmedResult, setConfirmedResult] = useState<{
    previousUpdatedAt: string;
    snapshotAt?: number;
    set: WorkoutSet;
  } | null>(null);
  // Read-only canonical GET snapshots supersede a local PATCH acknowledgment,
  // including a server PENDING reply with the same set updatedAt timestamp.
  const visibleSet =
    confirmedResult?.set.id === set.id &&
    confirmedResult.previousUpdatedAt === set.updatedAt &&
    confirmedResult.snapshotAt === canonicalSnapshotAt
      ? confirmedResult.set
      : set;
  const isSaved = visibleSet.status !== 'PENDING';
  const isEditing = !isSaved || editing;
  const limited = retryAt !== null;
  const uncertainWriteUnverified =
    unverifiedReadVersion !== null && canonicalReadVersion <= unverifiedReadVersion;
  const writingBlocked = reconciling || uncertainWriteUnverified;
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutSetFormValues>({
    resolver: zodResolver(workoutSetFormSchema),
    defaultValues: {
      actualReps: String(set.actualReps ?? set.plannedReps ?? ''),
      actualWeightKg: String(set.actualWeightKg ?? set.plannedWeightKg ?? ''),
    },
  });

  useEffect(() => {
    reset({
      actualReps: String(visibleSet.actualReps ?? visibleSet.plannedReps ?? ''),
      actualWeightKg: String(visibleSet.actualWeightKg ?? visibleSet.plannedWeightKg ?? ''),
    });
  }, [
    reset,
    visibleSet.actualReps,
    visibleSet.actualWeightKg,
    visibleSet.plannedReps,
    visibleSet.plannedWeightKg,
  ]);

  useEffect(() => {
    if (retryAt === null) return;
    const timeout = setTimeout(() => setRetryAt(null), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [retryAt]);

  const captureWriteFailure = (error: unknown, previousSnapshotAt: number) => {
    if (error instanceof WorkoutSetOutcomeUnknownError && !error.canonicalStateVerified) {
      setUnverifiedReadVersion(Math.max(previousSnapshotAt, error.readVersionAtFailure));
    }
    captureRateLimit(error);
  };

  const captureRateLimit = (error: unknown) => {
    if (error instanceof WorkoutSetRateLimitError) {
      setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    }
  };

  const saveCompleted = () => {
    // A synchronous lock prevents two presses before isPending rerenders the row.
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    submitLock.current = true;
    const before = canonicalReadVersion;
    void handleSubmit(
      async (values) => {
        try {
          const updated = await mutation.mutateAsync({
            setId: set.id,
            body: workoutSetPayload(values),
          });
          setConfirmedResult({
            previousUpdatedAt: set.updatedAt,
            snapshotAt: canonicalSnapshotAt,
            set: updated,
          });
          setEditing(false);
        } catch (error) {
          captureWriteFailure(error, before);
          throw error;
        } finally {
          submitLock.current = false;
        }
      },
      () => {
        submitLock.current = false;
      },
    )().catch(() => {
      // React Query exposes the failure through mutation.error below.
    });
  };

  const skipSet = () => {
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    submitLock.current = true;
    const before = canonicalReadVersion;
    void mutation
      .mutateAsync({ setId: set.id, body: { status: 'SKIPPED' } })
      .then((updated) => {
        setConfirmedResult({
          previousUpdatedAt: set.updatedAt,
          snapshotAt: canonicalSnapshotAt,
          set: updated,
        });
        setEditing(false);
      })
      .catch((error: unknown) => {
        captureWriteFailure(error, before);
      })
      .finally(() => {
        submitLock.current = false;
      })
      .catch(() => {
        // The mutation error is shown to the user below.
      });
  };

  const savingDisabled =
    !editable || mutation.isPending || isSubmitting || limited || writingBlocked;
  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>Підхід {set.setNumber}</Text>
        <Text style={isSaved ? styles.saved : styles.caption}>
          {visibleSet.status === 'PENDING'
            ? 'Очікує'
            : visibleSet.status === 'COMPLETED'
              ? '✓ Збережено'
              : '✓ Пропущено'}
        </Text>
      </View>
      <Text style={styles.caption}>
        План: {set.plannedReps ?? '—'} повт. · {set.plannedWeightKg ?? '—'} кг
      </Text>
      {isSaved ? (
        <Text style={styles.caption}>
          Результат: {visibleSet.actualReps ?? '—'} повт. · {visibleSet.actualWeightKg ?? '—'} кг
        </Text>
      ) : null}
      {editable && isSaved && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Редагувати підхід ${set.setNumber}`}
          testID={`set-edit-${set.id}`}
          disabled={savingDisabled}
          onPress={() => setEditing(true)}
          style={styles.editButton}
        >
          <Text style={styles.editText}>Редагувати результат</Text>
        </Pressable>
      ) : null}
      {editable && isEditing ? (
        <>
          <View style={styles.inputs}>
            <View style={styles.field}>
              <Text style={styles.caption}>Повторення</Text>
              <Controller
                control={control}
                name="actualReps"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    accessibilityLabel={`Повторення, підхід ${set.setNumber}`}
                    testID={`set-reps-${set.id}`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="number-pad"
                    editable={!savingDisabled}
                    style={styles.input}
                  />
                )}
              />
              {errors.actualReps?.message ? (
                <Text style={styles.error}>{errors.actualReps.message}</Text>
              ) : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.caption}>Вага, кг</Text>
              <Controller
                control={control}
                name="actualWeightKg"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    accessibilityLabel={`Вага, підхід ${set.setNumber}`}
                    testID={`set-weight-${set.id}`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    editable={!savingDisabled}
                    style={styles.input}
                  />
                )}
              />
              {errors.actualWeightKg?.message ? (
                <Text style={styles.error}>{errors.actualWeightKg.message}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              testID={`set-complete-${set.id}`}
              accessibilityRole="button"
              disabled={savingDisabled}
              accessibilityState={{ disabled: savingDisabled }}
              style={styles.button}
              onPress={saveCompleted}
            >
              <Text style={styles.buttonText}>
                {mutation.isPending ? 'Зберігаємо…' : 'Підтвердити підхід'}
              </Text>
            </Pressable>
            <Pressable
              testID={`set-skip-${set.id}`}
              accessibilityRole="button"
              disabled={savingDisabled}
              accessibilityState={{ disabled: savingDisabled }}
              style={styles.secondary}
              onPress={skipSet}
            >
              <Text style={styles.secondaryText}>Пропустити</Text>
            </Pressable>
          </View>
          {isSaved ? (
            <Pressable
              accessibilityRole="button"
              testID={`set-edit-cancel-${set.id}`}
              disabled={savingDisabled}
              onPress={() => {
                reset({
                  actualReps: String(visibleSet.actualReps ?? visibleSet.plannedReps ?? ''),
                  actualWeightKg: String(
                    visibleSet.actualWeightKg ?? visibleSet.plannedWeightKg ?? '',
                  ),
                });
                setEditing(false);
              }}
            >
              <Text style={styles.caption}>Скасувати редагування</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {uncertainWriteUnverified ? (
        <Text accessibilityRole="alert" testID={`set-uncertain-${set.id}`} style={styles.error}>
          Запис міг бути збережений. Повторне надсилання заблоковано до перевірки стану із сервера.
        </Text>
      ) : null}
      {limited ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Ліміт запитів вичерпано. Повторне збереження тимчасово заблоковано.
        </Text>
      ) : null}
      {mutation.isPending ? <ActivityIndicator accessibilityLabel="Зберігаємо підхід" /> : null}
      {mutation.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error instanceof WorkoutSetOutcomeUnknownError &&
          (mutation.error.canonicalStateVerified ||
            (unverifiedReadVersion !== null && !uncertainWriteUnverified))
            ? 'Стан отримано із сервера. Перевірте підхід перед новою дією.'
            : mutation.error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, borderTopWidth: 1, borderColor: palette.border, paddingTop: 12 },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  saved: { fontSize: 13, color: '#86efac', fontWeight: '700' },
  editButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12 },
  editText: { color: palette.primary, fontWeight: '600' },
  caption: { fontSize: 13, color: palette.muted },
  inputs: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
    color: palette.text,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: palette.surface, fontWeight: '700' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: { color: palette.text, fontWeight: '600' },
  error: { color: '#ff6460', fontSize: 13 },
});
