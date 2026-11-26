import { useIntl } from 'react-intl';
import type { PreviousSetHint } from '@/features/workouts/lib/previous-set-hints';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  useWorkoutSetRow,
  type WorkoutSetRowOptions,
} from '@/features/workouts/model/use-workout-set-row';
import { createThemedStyles } from '@/shared/config/theme-provider';

function HistoricalSetHint({ hint, setId }: { hint: PreviousSetHint; setId: string }) {
  const intl = useIntl();
  const styles = useStyles();
  const { actualReps, actualWeightKg } = hint;
  const id =
    actualReps === null
      ? 'mobile.workout.previousSetWeight'
      : actualWeightKg === null
        ? 'mobile.workout.previousSetReps'
        : 'mobile.workout.previousSet';
  return (
    <Text testID={`set-previous-${setId}`} style={styles.caption}>
      {intl.formatMessage(
        { id },
        {
          weight:
            actualWeightKg === null
              ? ''
              : intl.formatNumber(actualWeightKg, { maximumFractionDigits: 2 }),
          reps: actualReps === null ? '' : intl.formatNumber(actualReps),
        },
      )}
    </Text>
  );
}

export function WorkoutSetRow(options: WorkoutSetRowOptions & { previousHint?: PreviousSetHint }) {
  const styles = useStyles();
  const { set, editable, reconciling = false } = options;
  const {
    visibleSet,
    isSaved,
    isEditing,
    editing,
    submitting,
    limited,
    uncertainWriteUnverified,
    writingBlocked,
    saving,
    savingDisabled,
    control,
    errors,
    saveCompleted,
    skipSet,
    beginEditing,
    cancelEditing,
    errorMessage,
  } = useWorkoutSetRow(options);
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
      {editable && !isSaved && options.previousHint ? (
        <HistoricalSetHint hint={options.previousHint} setId={set.id} />
      ) : null}
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
          onPress={beginEditing}
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
              onPress={cancelEditing}
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
      {errorMessage !== null ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: {
      gap: 8,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      padding: 12,
      minWidth: 0,
    },
    activeContainer: { borderColor: palette.primary },
    savedContainer: { backgroundColor: palette.setCompleteBackground, padding: 10, gap: 4 },
    disabled: { opacity: 0.5 },
    title: { fontSize: 15, fontWeight: '600', color: palette.text },
    headingRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
    saved: { fontSize: 13, color: palette.setCompleteForeground, fontWeight: '700' },
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
    error: { color: palette.error, fontSize: 13 },
  }),
);
