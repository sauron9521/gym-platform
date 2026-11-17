import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';
import {
  mobileMultiWorkoutFormSchema,
  type MobileMultiWorkoutForm,
} from '@/features/workouts/lib/create-workout-schema';
import { useCreateMultiMobileWorkout } from '@/features/workouts/model/workout-create';
import { palette } from '@/shared/config/theme';

type ExerciseFieldsProps = {
  index: number;
  disabled: boolean;
  canRemove: boolean;
  onRemove: () => void;
};

function WorkoutExerciseFields({ index, disabled, canRemove, onRemove }: ExerciseFieldsProps) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<MobileMultiWorkoutForm>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `exercises.${index}.sets` as const,
  });
  const selectedId = useWatch({ control, name: `exercises.${index}.exerciseId` as const });
  const exerciseErrors = errors.exercises?.[index];

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.label}>Вправа {index + 1}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Видалити вправу ${index + 1}`}
          accessibilityState={{ disabled: disabled || !canRemove }}
          testID={`workout-exercise-remove-${index}`}
          disabled={disabled || !canRemove}
          onPress={onRemove}
        >
          <Text style={styles.error}>Видалити вправу</Text>
        </Pressable>
      </View>
      <ExercisePicker
        selectedId={selectedId}
        disabled={disabled}
        onSelect={(id) =>
          setValue(`exercises.${index}.exerciseId`, id, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {exerciseErrors?.exerciseId?.message ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {exerciseErrors.exerciseId.message}
        </Text>
      ) : null}

      {fields.map((field, setIndex) => (
        <View key={field.id} style={styles.set}>
          <View style={styles.row}>
            <Text style={styles.label}>Підхід {setIndex + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Прибрати підхід ${setIndex + 1} вправи ${index + 1}`}
              accessibilityState={{ disabled: disabled || fields.length <= 1 }}
              testID={`workout-set-remove-${index}-${setIndex}`}
              disabled={disabled || fields.length <= 1}
              onPress={() => remove(setIndex)}
            >
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
                editable={!disabled}
              />
            )}
          />
          {exerciseErrors?.sets?.[setIndex]?.reps?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {exerciseErrors.sets[setIndex]?.reps?.message}
            </Text>
          ) : null}
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
                editable={!disabled}
              />
            )}
          />
          {exerciseErrors?.sets?.[setIndex]?.weightKg?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {exerciseErrors.sets[setIndex]?.weightKg?.message}
            </Text>
          ) : null}
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Додати підхід до вправи ${index + 1}`}
        accessibilityState={{ disabled: disabled || fields.length >= 100 }}
        testID={`workout-set-add-${index}`}
        disabled={disabled || fields.length >= 100}
        onPress={() => append({ reps: '10', weightKg: '' })}
        style={styles.secondary}
      >
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
    defaultValues: {
      title: '',
      exercises: [{ exerciseId: '', sets: [{ reps: '10', weightKg: '' }] }],
    },
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });
  const disabled = isSubmitting || createWorkout.isPending;

  const onValidSubmit = async (values: MobileMultiWorkoutForm) => {
    // React state may not update between repeated presses.
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      await createWorkout.mutateAsync(values);
      router.back();
    } catch {
      // Preserve form values for correction or an idempotent manual retry.
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <FormProvider {...form}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
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
              editable={!disabled}
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
            disabled={disabled}
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
          accessibilityState={{ disabled: disabled || fields.length >= 50 }}
          testID="workout-exercise-add"
          disabled={disabled || fields.length >= 50}
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
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => void handleSubmit(onValidSubmit)()}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {createWorkout.isPending ? 'Створюємо…' : 'Створити тренування'}
          </Text>
        </Pressable>
      </ScrollView>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 12, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 64 },
  heading: { fontSize: 25, fontWeight: '700', color: palette.text },
  label: { fontSize: 14, fontWeight: '600', color: palette.text },
  text: { color: palette.text, fontWeight: '600' },
  error: { color: '#ff6460', fontSize: 14 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    color: palette.text,
  },
  group: { gap: 12, padding: 14, borderColor: palette.border, borderWidth: 1, borderRadius: 12 },
  set: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: palette.surface },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondary: {
    padding: 14,
    borderRadius: 12,
    borderColor: palette.border,
    borderWidth: 1,
    minHeight: 44,
  },
  button: {
    backgroundColor: palette.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    minHeight: 48,
  },
  buttonText: { color: palette.surface, textAlign: 'center', fontWeight: '700' },
});
