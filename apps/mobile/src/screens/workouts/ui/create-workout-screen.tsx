import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';
import {
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';
import { palette } from '@/shared/config/theme';

function WorkoutExerciseFields({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { control, setValue, formState: { errors, isSubmitting } } = useFormContext<MobileMultiWorkoutForm>();
  const { fields, append, remove } = useFieldArray({ control, name: `exercises.${index}.sets` as const });
  const selectedId = useWatch({ control, name: `exercises.${index}.exerciseId` as const });
  const exerciseErrors = errors.exercises?.[index];

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.label}>Вправа {index + 1}</Text>
        <Pressable accessibilityRole="button" onPress={onRemove} disabled={isSubmitting}>
          <Text style={styles.error}>Видалити вправу</Text>
        </Pressable>
      </View>
      <ExercisePicker
        selectedId={selectedId}
        disabled={isSubmitting}
        onSelect={(id) => setValue(`exercises.${index}.exerciseId`, id, { shouldValidate: true })}
      />
      {exerciseErrors?.exerciseId?.message ? <Text style={styles.error}>{exerciseErrors.exerciseId.message}</Text> : null}
      {fields.map((field, setIndex) => (
        <View key={field.id} style={styles.set}>
          <View style={styles.row}>
            <Text style={styles.label}>Підхід {setIndex + 1}</Text>
            <Pressable accessibilityRole="button" disabled={fields.length <= 1 || isSubmitting} onPress={() => remove(setIndex)}>
              <Text style={styles.error}>Прибрати</Text>
            </Pressable>
          </View>
          <Controller
            control={control}
            name={`exercises.${index}.sets.${setIndex}.reps` as const}
            render={({ field: input }) => (
              <TextInput
                accessibilityLabel={`Повторення, вправа ${index + 1}, підхід ${setIndex + 1}`}
                keyboardType="number-pad"
                value={input.value}
                onChangeText={input.onChange}
                onBlur={input.onBlur}
                style={styles.input}
                editable={!isSubmitting}
              />
            )}
          />
          {exerciseErrors?.sets?.[setIndex]?.reps?.message ? <Text style={styles.error}>{exerciseErrors.sets[setIndex]?.reps?.message}</Text> : null}
          <Controller
            control={control}
            name={`exercises.${index}.sets.${setIndex}.weightKg` as const}
            render={({ field: input }) => (
              <TextInput
                accessibilityLabel={`Планова вага, вправа ${index + 1}, підхід ${setIndex + 1}`}
                placeholder="Вага, кг (необов’язково)"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={input.value}
                onChangeText={input.onChange}
                onBlur={input.onBlur}
                style={styles.input}
                editable={!isSubmitting}
              />
            )}
          />
          {exerciseErrors?.sets?.[setIndex]?.weightKg?.message ? <Text style={styles.error}>{exerciseErrors.sets[setIndex]?.weightKg?.message}</Text> : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" disabled={isSubmitting || fields.length >= 100} onPress={() => append({ reps: '10', weightKg: '' })} style={styles.secondary}>
        <Text style={styles.text}>+ Додати підхід</Text>
      </Pressable>
    </View>
  );
}

export function CreateWorkoutScreen() {
  const router = useRouter();
  const createWorkout = useCreateMultiMobileWorkout();
  const submitLock = useRef(false);
  const form = useForm<MobileMultiWorkoutForm>({
    resolver: zodResolver(mobileMultiWorkoutFormSchema),
    defaultValues: { title: '', exercises: [{ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] }] },
  });
  const { control, handleSubmit, formState: { errors, isSubmitting } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });

  const onValidSubmit = async (values: MobileMultiWorkoutForm) => {
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      await createWorkout.mutateAsync(values);
      router.back();
    } catch {
      // Keep the draft available for correction and an idempotent manual retry.
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <FormProvider {...form}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Нове тренування</Text>
        <Text style={styles.label}>Назва</Text>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <TextInput
              accessibilityLabel="Назва тренування"
              placeholder="Тренування грудей"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!createWorkout.isPending}
            />
          )}
        />
        {errors.title?.message ? <Text style={styles.error}>{errors.title.message}</Text> : null}
        {fields.map((field, index) => (
          <WorkoutExerciseFields
            key={field.id}
            index={index}
            onRemove={() => remove(index)}
          />
        ))}
        {errors.exercises?.root?.message ? <Text style={styles.error}>{errors.exercises.root.message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || fields.length >= 50}
          onPress={() => append({ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] })}
          style={styles.secondary}
        >
          <Text style={styles.text}>+ Додати вправу</Text>
        </Pressable>
        {createWorkout.isError ? <Text accessibilityRole="alert" style={styles.error}>{createWorkout.error.message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          testID="create-workout-submit"
          disabled={createWorkout.isPending || isSubmitting}
          onPress={() => void handleSubmit(onValidSubmit)()}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{createWorkout.isPending ? 'Створюємо…' : 'Створити тренування'}</Text>
        </Pressable>
      </ScrollView>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 12, padding: 24, paddingBottom: 48 },
  heading: { fontSize: 25, fontWeight: '700', color: palette.text },
  label: { fontSize: 14, fontWeight: '600', color: palette.text },
  text: { color: palette.text, fontWeight: '600' },
  error: { color: '#ff6460', fontSize: 14 },
  input: { minHeight: 48, borderRadius: 12, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, paddingHorizontal: 14, color: palette.text },
  group: { gap: 12, padding: 14, borderColor: palette.border, borderWidth: 1, borderRadius: 12 },
  set: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: palette.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  secondary: { padding: 14, borderRadius: 12, borderColor: palette.border, borderWidth: 1, minHeight: 44 },
  button: { backgroundColor: palette.primary, padding: 16, borderRadius: 12, marginTop: 8, minHeight: 48 },
  buttonText: { color: palette.surface, textAlign: 'center', fontWeight: '700' },
});
