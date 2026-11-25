import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { strengthVolumeHeights } from '@/features/progress/lib/chart';
import { exercisePersonalBests } from '@/features/progress/lib/personal-bests';
import { useExerciseProgress } from '@/features/progress/model/exercise-progress-query';
import type { ProgressRange } from '@/features/progress/model/workout-summary-query';
import { createThemedStyles } from '@/shared/config/theme-provider';

const periods: ProgressRange[] = ['7d', '30d', '90d'];

export function ExerciseProgressScreen({ id }: { id: string }) {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `mobile.exerciseRecords.${key}` }, values);
  const dateLocale = intl.locale === 'en' ? 'en-US' : 'uk-UA';
  const displayDay = (day: string) =>
    new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
  const [range, setRange] = useState<ProgressRange>('30d');
  const query = useExerciseProgress(id, range);
  const data = query.data;
  const heights = useMemo(() => strengthVolumeHeights(data?.daily ?? []), [data?.daily]);
  const highlights = useMemo(() => exercisePersonalBests(data?.daily ?? []), [data?.daily]);
  const bestWeightLabel =
    highlights.bestWeightKg === null ? '—' : t('kg', { value: highlights.bestWeightKg });
  const bestVolumeLabel = highlights.bestVolumeDay
    ? t('volumeDate', {
        value: Math.round(highlights.bestVolumeDay.volumeKg),
        date: displayDay(highlights.bestVolumeDay.date),
      })
    : '—';

  if (!id) {
    return (
      <View style={styles.content}>
        <Text accessibilityRole="alert" style={styles.error}>
          Некоректний ідентифікатор вправи.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{data?.name || 'Прогрес вправи'}</Text>
      <View style={styles.row}>
        {periods.map((period) => (
          <Pressable
            key={period}
            testID={`exercise-progress-range-${period}`}
            accessibilityRole="button"
            accessibilityState={{ selected: range === period }}
            onPress={() => setRange(period)}
            style={[styles.chip, range === period && styles.selected]}
          >
            <Text style={styles.text}>{period}</Text>
          </Pressable>
        ))}
      </View>
      {query.isPending ? (
        <ActivityIndicator accessibilityLabel="Завантаження прогресу вправи" />
      ) : null}
      {query.isError ? (
        <View style={styles.errorGroup}>
          <Text accessibilityRole="alert" style={styles.error}>
            {query.error?.message ?? 'Не вдалося завантажити прогрес вправи.'}
          </Text>
          <Pressable
            testID="exercise-progress-retry"
            accessibilityRole="button"
            accessibilityState={{ disabled: query.isFetching }}
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
            style={styles.retry}
          >
            <Text style={styles.text}>Повторити завантаження</Text>
          </Pressable>
        </View>
      ) : null}
      {data ? (
        <>
          <View style={styles.highlightGroup} accessibilityLabel={t('group')}>
            <Text style={styles.highlightTitle}>{t('title', { range })}</Text>
            <Text style={styles.metric}>{t('weight', { value: bestWeightLabel })}</Text>
            <Text style={styles.metric}>{t('days', { count: highlights.activeDays })}</Text>
            <Text style={styles.metric}>{t('volume', { value: bestVolumeLabel })}</Text>
          </View>
          <Text style={styles.metric}>Підходів: {data.completedSets}</Text>
          <Text style={styles.metric}>Повторень: {data.strengthReps}</Text>
          <Text style={styles.metric}>Об’єм: {Math.round(data.strengthVolumeKg)} кг</Text>
          {data.daily.some((day) => day.strengthVolumeKg > 0) ? (
            <View style={styles.chart} accessibilityLabel="Щоденний об’єм вправи">
              {data.daily.map((day, index) => (
                <View
                  key={day.date}
                  accessible
                  style={styles.day}
                  accessibilityLabel={`${day.date}: ${Math.round(day.strengthVolumeKg)} кг`}
                >
                  <View style={[styles.bar, { height: `${heights[index] ?? 0}%` }]} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>За цей період записів ще немає.</Text>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { gap: 14, padding: 24 },
    heading: { color: palette.text, fontWeight: '700', fontSize: 25 },
    metric: { color: palette.text, fontSize: 17 },
    highlightGroup: {
      gap: 8,
      padding: 14,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 12,
    },
    highlightTitle: { color: palette.primary, fontSize: 17, fontWeight: '700' },
    text: { color: palette.text },
    muted: { color: palette.muted },
    error: { color: palette.error },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      padding: 10,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 10,
      minHeight: 44,
    },
    selected: { borderColor: palette.primary, borderWidth: 2 },
    errorGroup: { gap: 10 },
    retry: {
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      minHeight: 44,
    },
    chart: {
      height: 160,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: palette.surface,
      gap: 3,
      padding: 12,
      borderRadius: 12,
    },
    day: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { backgroundColor: palette.primary, width: '100%' },
  }),
);
