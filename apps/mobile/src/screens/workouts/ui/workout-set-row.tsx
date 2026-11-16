import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  workoutSetFormSchema,
  workoutSetPayload,
  type WorkoutSetFormValues,
} from '@/features/workouts/lib/workout-set-form';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';
import { useWorkoutSetMutation } from '@/features/workouts/model/workout-set-mutation';
import { palette } from '@/shared/config/theme';

type WorkoutSet = WorkoutDetails['exercises'][number]['sets'][number];

export function WorkoutSetRow({
  workoutId,
  set,
  editable,
}: {
  workoutId: string;
  set: WorkoutSet;
  editable: boolean;
}) {
  const mutation = useWorkoutSetMutation(workoutId);
  const submitLock = useRef(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkoutSetFormValues>({
    resolver: zodResolver(workoutSetFormSchema),
    defaultValues: {
      actualReps: String(set.actualReps ?? set.plannedReps ?? ''),
      actualWeightKg: String(set.actualWeightKg ?? set.plannedWeightKg ?? ''),
    },
  });

  const saveCompleted = () => {
    // A synchronous lock prevents two presses before isPending rerenders the row.
    if (submitLock.current || mutation.isPending || !editable) return;
    submitLock.current = true;
    void handleSubmit(
      async (values) => {
        try {
          await mutation.mutateAsync({ setId: set.id, body: workoutSetPayload(values) });
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
    if (submitLock.current || mutation.isPending || !editable) return;
    submitLock.current = true;
    void mutation
      .mutateAsync({ setId: set.id, body: { status: 'SKIPPED' } })
      .finally(() => {
        submitLock.current = false;
      })
      .catch(() => {
        // The mutation error is shown to the user below.
      });
  };

  const savingDisabled = !editable || mutation.isPending || isSubmitting;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Підхід {set.setNumber} ·{' '}
        {set.status === 'PENDING'
          ? 'Очікує'
          : set.status === 'COMPLETED'
            ? 'Виконано'
            : 'Пропущено'}
      </Text>
      <Text style={styles.caption}>
        План: {set.plannedReps ?? '—'} повт. · {set.plannedWeightKg ?? '—'} кг
      </Text>
      {editable ? (
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
                    editable={!mutation.isPending}
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
                    editable={!mutation.isPending}
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
              style={styles.button}
              onPress={saveCompleted}
            >
              <Text style={styles.buttonText}>Виконано</Text>
            </Pressable>
            <Pressable
              testID={`set-skip-${set.id}`}
              accessibilityRole="button"
              disabled={savingDisabled}
              style={styles.secondary}
              onPress={skipSet}
            >
              <Text style={styles.secondaryText}>Пропустити</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {mutation.isPending ? <ActivityIndicator accessibilityLabel="Зберігаємо підхід" /> : null}
      {mutation.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, borderTopWidth: 1, borderColor: palette.border, paddingTop: 12 },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
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
