import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';
import type { MobileMultiWorkoutForm } from '@/features/workouts/lib/create-workout-schema';
import { useMobileTheme } from '@/shared/config/theme-provider';
import { useWorkoutFormStyles } from './create-workout-form-styles';

type ExerciseFieldsProps = {
  index: number;
  disabled: boolean;
  canRemove: boolean;
  onRemove: () => void;
};

export function WorkoutExerciseFields({
  index,
  disabled,
  canRemove,
  onRemove,
}: ExerciseFieldsProps) {
  const styles = useWorkoutFormStyles();
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
        <WorkoutSetFields
          key={field.id}
          index={index}
          setIndex={setIndex}
          control={control}
          disabled={disabled}
          canRemove={fields.length > 1}
          onRemove={() => remove(setIndex)}
          repsError={exerciseErrors?.sets?.[setIndex]?.reps?.message}
          weightError={exerciseErrors?.sets?.[setIndex]?.weightKg?.message}
        />
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

type SetFieldsProps = {
  index: number;
  setIndex: number;
  control: Control<MobileMultiWorkoutForm>;
  disabled: boolean;
  canRemove: boolean;
  onRemove: () => void;
  repsError?: string;
  weightError?: string;
};

function WorkoutSetFields({
  index,
  setIndex,
  control,
  disabled,
  canRemove,
  onRemove,
  repsError,
  weightError,
}: SetFieldsProps) {
  const styles = useWorkoutFormStyles();
  const { palette } = useMobileTheme();
  return (
    <View style={styles.set}>
      <View style={styles.row}>
        <Text style={styles.label}>Підхід {setIndex + 1}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Прибрати підхід ${setIndex + 1} вправи ${index + 1}`}
          accessibilityState={{ disabled: disabled || !canRemove }}
          testID={`workout-set-remove-${index}-${setIndex}`}
          disabled={disabled || !canRemove}
          onPress={onRemove}
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
      {repsError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {repsError}
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
      {weightError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {weightError}
        </Text>
      ) : null}
    </View>
  );
}
