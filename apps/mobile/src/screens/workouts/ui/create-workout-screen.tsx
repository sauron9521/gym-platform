import { Controller, FormProvider } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';
import { useCreateWorkoutForm } from '../model/use-create-workout-form';
import { useWorkoutFormStyles } from './create-workout-form-styles';
import type { OfflineDraftLifecycle } from '@/features/workouts/model/offline-draft-lifecycle';
import { WorkoutDraftPanel } from './workout-draft-panel';
import { WorkoutExerciseFields } from './workout-exercise-fields';

export function CreateWorkoutScreen({ lifecycle }: { lifecycle?: OfflineDraftLifecycle } = {}) {
  const styles = { ...useStyles(), ...useWorkoutFormStyles() };
  const { palette } = useMobileTheme();
  const {
    form,
    control,
    errors,
    fields,
    append,
    remove,
    disabled,
    createWorkout,
    submit,
    draft,
    submissionStarted,
  } = useCreateWorkoutForm(lifecycle);

  return (
    <FormProvider {...form}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={false}
        testID="create-workout-scroll"
      >
        <Text style={styles.heading}>Нове тренування</Text>
        <WorkoutDraftPanel
          draft={draft}
          disabled={disabled}
          submissionStarted={submissionStarted}
        />
        {!draft.hideForm ? (
          <>
            <Text style={styles.label}>Назва</Text>
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <TextInput
                  testID="workout-draft-title-input"
                  accessibilityLabel="Назва тренування"
                  placeholder="Тренування грудей"
                  placeholderTextColor={palette.muted}
                  style={styles.input}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!disabled && !draft.readOnly}
                />
              )}
            />
            {errors.title?.message ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors.title.message}
              </Text>
            ) : null}

            {fields.map((field, index) => (
              <WorkoutExerciseFields
                key={field.id}
                index={index}
                disabled={disabled || draft.readOnly}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
            {errors.exercises?.root?.message ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors.exercises.root.message}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Додати вправу"
              accessibilityState={{ disabled: disabled || draft.readOnly || fields.length >= 50 }}
              testID="workout-exercise-add"
              disabled={disabled || draft.readOnly || fields.length >= 50}
              onPress={() => append({ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] })}
              style={styles.secondary}
            >
              <Text style={styles.text}>+ Додати вправу</Text>
            </Pressable>

            {createWorkout.isError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {createWorkout.error.message}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              testID="create-workout-submit"
              accessibilityState={{ disabled: disabled || draft.blocksSubmission() }}
              disabled={disabled || draft.blocksSubmission()}
              onPress={submit}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {createWorkout.isPending ? 'Створюємо…' : 'Створити тренування'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </FormProvider>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { gap: 12, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 64 },
    heading: { fontSize: 25, fontWeight: '700', color: palette.text },
    button: {
      backgroundColor: palette.primary,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      minHeight: 48,
    },
    buttonText: { color: palette.primaryForeground, textAlign: 'center', fontWeight: '700' },
  }),
);
