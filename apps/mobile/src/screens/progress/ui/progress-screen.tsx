import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExercisePicker } from '@/features/exercises/ui/exercise-picker';
import { strengthVolumeHeights } from '@/features/progress/lib/chart';
import {
  useWorkoutSummary,
  type ProgressRange,
} from '@/features/progress/model/workout-summary-query';
import { createThemedStyles } from '@/shared/config/theme-provider';

const periods: ProgressRange[] = ['7d', '30d', '90d'];

export function ProgressScreen() {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `mobile.progressView.${key}` }, values);
  const dateLocale = intl.locale === 'en' ? 'en-US' : 'uk-UA';
  const displayDay = (day: string) =>
    new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
  const router = useRouter();
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [range, setRange] = useState<ProgressRange>('30d');
  const query = useWorkoutSummary(range);
  const heights = useMemo(() => strengthVolumeHeights(query.data?.daily ?? []), [query.data]);
  const stats = query.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} bounces={false}>
      <Text style={styles.title}>{t('title')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('refreshAria')}
        testID="progress-refresh"
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
        style={styles.retryButton}
      >
        <Text style={styles.text}>{query.isFetching ? t('refreshing') : t('refresh')}</Text>
      </Pressable>
      <Text style={styles.heading}>{t('exerciseStats')}</Text>
      <ExercisePicker
        selectedId={selectedExerciseId}
        onSelect={(id) => {
          setSelectedExerciseId(id);
          router.push({ pathname: '/progress/exercises/[id]', params: { id } });
        }}
      />
      <View style={styles.filters}>
        {periods.map((period) => (
          <Pressable
            key={period}
            testID={`progress-range-${period}`}
            accessibilityRole="button"
            accessibilityLabel={t(`range${period}`)}
            accessibilityState={{ selected: range === period }}
            onPress={() => setRange(period)}
            style={[styles.chip, period === range && styles.selected]}
          >
            <Text style={[styles.text, period === range && styles.selectedText]}>{period}</Text>
          </Pressable>
        ))}
      </View>
      {query.isPending ? <ActivityIndicator accessibilityLabel={t('loading')} /> : null}
      {query.isError ? (
        <View style={styles.errorGroup}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('error')}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="progress-retry"
            onPress={() => void query.refetch()}
            style={styles.retryButton}
            disabled={query.isFetching}
          >
            <Text style={styles.text}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {stats ? (
        <>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.metric}>{stats.workoutCount}</Text>
              <Text style={styles.subtitle}>{t('workouts')}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.metric}>{stats.activeDays}</Text>
              <Text style={styles.subtitle}>{t('activeDays')}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.metric}>{stats.completedSets}</Text>
              <Text style={styles.subtitle}>{t('sets')}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.metric}>{Math.round(stats.strengthVolumeKg)}</Text>
              <Text style={styles.subtitle}>{t('volume')}</Text>
            </View>
          </View>
          <Text style={styles.heading}>{t('chart')}</Text>
          {stats.daily.some((day) => day.strengthVolumeKg > 0) ? (
            <View style={styles.chart}>
              {stats.daily.map((day, index) => (
                <View
                  key={day.date}
                  accessible
                  accessibilityLabel={t('bar', {
                    date: displayDay(day.date),
                    volume: Math.round(day.strengthVolumeKg),
                  })}
                  style={styles.barCell}
                >
                  <View style={[styles.bar, { height: `${heights[index] ?? 0}%` }]} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.subtitle}>
              {stats.daily.length === 0 ? t('noData') : t('noVolume')}
            </Text>
          )}
          <Text style={styles.subtitle}>
            {t('updated', { date: new Date(stats.asOf).toLocaleDateString(dateLocale) })}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { padding: 24, gap: 18 },
    title: { fontSize: 27, fontWeight: '700', color: palette.text },
    heading: { fontSize: 18, fontWeight: '600', color: palette.text },
    subtitle: { color: palette.muted, fontSize: 13 },
    metric: { fontSize: 25, fontWeight: '700', color: palette.primary },
    text: { color: palette.text, fontWeight: '600' },
    filters: { flexDirection: 'row', gap: 9 },
    chip: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    selected: { backgroundColor: palette.primary },
    selectedText: { color: palette.primaryForeground },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
      width: '47%',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      backgroundColor: palette.surface,
      padding: 15,
      gap: 5,
    },
    chart: {
      minHeight: 170,
      height: 170,
      backgroundColor: palette.surface,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 2,
    },
    barCell: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', backgroundColor: palette.primary, borderRadius: 2 },
    error: { color: palette.error, fontSize: 14 },
    errorGroup: { gap: 10 },
    retryButton: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
