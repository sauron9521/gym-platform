import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import {
  mobileWorkoutFormSchema,
  type MobileWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import {
  useCreateMobileWorkout,
  useWorkoutExerciseOptions,
} from '@/features/workouts/model/workout-create';
import { palette } from '@/shared/config/theme';

export function CreateWorkoutScreen() {
  const router = useRouter();
  const exercises = useWorkoutExerciseOptions();
  const createWorkout = useCreateMobileWorkout();
  const submitLock = useRef(false);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MobileWorkoutForm>({
    resolver: zodResolver(mobileWorkoutFormSchema),
    defaultValues: { title: '', exerciseId: '', reps: '10' },
  });
  const selectedExercise = useWatch({ control, name: 'exerciseId' });

  const onValidSubmit = async (values: MobileWorkoutForm) => {
    // React state does not synchronously prevent a second press before rerender.
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      await createWorkout.mutateAsync({
        title: values.title,
        exerciseId: values.exerciseId,
        plannedReps: Number(values.reps),
      });
      router.back();
    } catch {
      // The safe mutation error is displayed below; do not navigate on failure.
    } finally {
      submitLock.current = false;
    }
  };
  const submit = () => void handleSubmit(onValidSubmit)();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Нове тренування</Text>
      <Text style={styles.muted}>Одна вправа й один запланований підхід.</Text>
      <Text style={styles.label}>Назва</Text>
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel="Назва тренування"
            placeholder="Тренування грудей"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!createWorkout.isPending}
          />
        )}
      />
      {errors.title ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.title.message}
        </Text>
      ) : null}
      <Text style={styles.label}>Вправа</Text>
      {exercises.isPending ? <ActivityIndicator accessibilityLabel="Завантаження вправ" /> : null}
      {exercises.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {exercises.error.message}
        </Text>
      ) : null}
      {exercises.isError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Повторити завантаження вправ"
          onPress={() => void exercises.refetch()}
          style={styles.exercise}
        >
          <Text style={styles.text}>Спробувати ще раз</Text>
        </Pressable>
      ) : null}
      {exercises.data?.length ? (
        <Text style={styles.muted}>Показано перші 20 доступних вправ.</Text>
      ) : null}
      {exercises.data?.map((exercise) => (
        <Pressable
          key={exercise.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedExercise === exercise.id }}
          disabled={createWorkout.isPending || isSubmitting}
          onPress={() => setValue('exerciseId', exercise.id, { shouldValidate: true })}
          style={[styles.exercise, selectedExercise === exercise.id && styles.selected]}
        >
          <Text style={styles.text}>{exercise.name}</Text>
        </Pressable>
      ))}
      {errors.exerciseId ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.exerciseId.message}
        </Text>
      ) : null}
      <Text style={styles.label}>Повторення</Text>
      <Controller
        control={control}
        name="reps"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel="Кількість повторень"
            keyboardType="number-pad"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!createWorkout.isPending}
            style={styles.input}
          />
        )}
      />
      {errors.reps ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.reps.message}
        </Text>
      ) : null}
      {createWorkout.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {createWorkout.error.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        testID="create-workout-submit"
        disabled={createWorkout.isPending || isSubmitting || !exercises.data?.length}
        onPress={() => void submit()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {createWorkout.isPending ? 'Створюємо…' : 'Створити тренування'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 12, padding: 24 },
  heading: { fontSize: 25, fontWeight: '700', color: palette.text },
  label: { fontSize: 14, fontWeight: '600', color: palette.text },
  text: { fontSize: 15, color: palette.text },
  muted: { fontSize: 14, color: palette.muted },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    color: palette.text,
  },
  exercise: { padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12 },
  selected: { borderColor: palette.primary },
  error: { color: '#ff6460', fontSize: 14 },
  button: { backgroundColor: palette.primary, padding: 16, borderRadius: 12, marginTop: 8 },
  buttonText: { color: palette.surface, textAlign: 'center', fontWeight: '700' },
});
