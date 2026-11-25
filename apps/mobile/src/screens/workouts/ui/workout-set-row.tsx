import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  actionBlocked = false,
  onWriteStart,
  onWriteSettled,
  onNewCompletion,
}: {
  workoutId: string;
  set: WorkoutSet;
  editable: boolean;
  reconciling?: boolean;
  canonicalSnapshotAt?: number;
  canonicalReadVersion?: number;
  actionBlocked?: boolean;
  onWriteStart?: (setId: string) => boolean;
  onWriteSettled?: (setId: string, requiredReadVersion: number | null) => void;
  onNewCompletion?: () => void;
}) {
  const mutation = useWorkoutSetMutation(workoutId);
  const submitLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState<'complete' | 'skip' | null>(null);
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
  const writingBlocked = reconciling || uncertainWriteUnverified || actionBlocked;
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
    captureRateLimit(error);
    if (error instanceof WorkoutSetOutcomeUnknownError && !error.canonicalStateVerified) {
      const required = Math.max(previousSnapshotAt, error.readVersionAtFailure);
      setUnverifiedReadVersion(required);
      return required;
    }
    return null;
  };

  const captureRateLimit = (error: unknown) => {
    if (error instanceof WorkoutSetRateLimitError) {
      setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    }
  };

  const saveCompleted = async () => {
    // Lock immediately, before asynchronous validation or mutation state updates.
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    if (onWriteStart && !onWriteStart(set.id)) return;
    submitLock.current = true;
    setSubmitting('complete');
    const before = canonicalReadVersion;
    let requiredReadVersion: number | null = null;
    try {
      await handleSubmit(async (values) => {
        Keyboard.dismiss();
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
        if (visibleSet.status === 'PENDING' && updated.status === 'COMPLETED') {
          onNewCompletion?.();
        }
      })();
    } catch (error) {
      requiredReadVersion = captureWriteFailure(error, before);
    } finally {
      submitLock.current = false;
      setSubmitting(null);
      onWriteSettled?.(set.id, requiredReadVersion);
    }
  };

  const skipSet = async () => {
    if (
      submitLock.current ||
      mutation.isPending ||
      !editable ||
      !isEditing ||
      limited ||
      writingBlocked
    )
      return;
    if (onWriteStart && !onWriteStart(set.id)) return;
    submitLock.current = true;
    setSubmitting('skip');
    const before = canonicalReadVersion;
    let requiredReadVersion: number | null = null;
    try {
      Keyboard.dismiss();
      const updated = await mutation.mutateAsync({ setId: set.id, body: { status: 'SKIPPED' } });
      setConfirmedResult({
        previousUpdatedAt: set.updatedAt,
        snapshotAt: canonicalSnapshotAt,
        set: updated,
      });
      setEditing(false);
    } catch (error) {
      requiredReadVersion = captureWriteFailure(error, before);
    } finally {
      submitLock.current = false;
      setSubmitting(null);
      onWriteSettled?.(set.id, requiredReadVersion);
    }
  };

  const saving = submitting !== null || mutation.isPending || isSubmitting;
  const savingDisabled = !editable || saving || limited || writingBlocked;
  return (
    <View
      style={[
        styles.container,
        editable && isEditing && styles.activeContainer,
        isSaved && !isEditing && styles.savedContainer,
      ]}
    >
      <View style={styles.headingRow}>
        <Text style={styles.title}>Підхід {set.setNumber}</Text>
        <Text
          testID={`set-status-${set.id}`}
          accessibilityLiveRegion="polite"
          style={
            saving || writingBlocked || limited
              ? styles.caption
              : isSaved
                ? styles.saved
                : styles.caption
          }
        >
          {saving
            ? 'Зберігаємо…'
            : uncertainWriteUnverified
              ? 'Потрібна перевірка'
              : reconciling
                ? 'Перевіряємо…'
                : limited
                  ? 'Зачекайте'
                  : visibleSet.status === 'PENDING'
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
                <Text accessibilityRole="alert" style={styles.error}>
                  {errors.actualReps.message}
                </Text>
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
                <Text accessibilityRole="alert" style={styles.error}>
                  {errors.actualWeightKg.message}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              testID={`set-complete-${set.id}`}
              accessibilityRole="button"
              disabled={savingDisabled}
              accessibilityState={{ disabled: savingDisabled, busy: saving }}
              style={[styles.button, savingDisabled && styles.disabled]}
              onPress={() => void saveCompleted()}
            >
              <Text style={styles.buttonText}>
                {submitting === 'complete' ? 'Підтверджуємо…' : 'Підтвердити підхід'}
              </Text>
            </Pressable>
            <Pressable
              testID={`set-skip-${set.id}`}
              accessibilityRole="button"
              disabled={savingDisabled}
              accessibilityState={{ disabled: savingDisabled, busy: saving }}
              style={[styles.secondary, savingDisabled && styles.disabled]}
              onPress={() => void skipSet()}
            >
              <Text style={styles.secondaryText}>
                {submitting === 'skip' ? 'Пропускаємо…' : 'Пропустити'}
              </Text>
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
      {saving ? <ActivityIndicator accessibilityLabel="Зберігаємо підхід" /> : null}
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
  container: {
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    minWidth: 0,
  },
  activeContainer: { borderColor: palette.primary },
  savedContainer: { backgroundColor: palette.background, padding: 10, gap: 4 },
  disabled: { opacity: 0.5 },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  saved: { fontSize: 13, color: '#86efac', fontWeight: '700' },
  editButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12 },
  editText: { color: palette.primary, fontWeight: '600' },
  caption: { fontSize: 13, color: palette.muted },
  inputs: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, minWidth: 0, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
    color: palette.text,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: {
    flex: 1,
    minWidth: 120,
    padding: 8,
    backgroundColor: palette.primary,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: palette.primaryForeground, fontWeight: '700', textAlign: 'center' },
  secondary: {
    flex: 1,
    minWidth: 100,
    padding: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: { color: palette.text, fontWeight: '600', textAlign: 'center' },
  error: { color: '#ff6460', fontSize: 13 },
});
