import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useExerciseProgress } from '@/features/progress/model/exercise-progress-query';
import type { ProgressRange } from '@/features/progress/model/workout-summary-query';
import { strengthVolumeHeights } from '@/features/progress/lib/chart';
import { palette } from '@/shared/config/theme';

export function ExerciseProgressScreen({ id }: { id: string }) {
  const [range, setRange] = useState<ProgressRange>('30d');
  const progress = useExerciseProgress(id, range);
  const data = progress.data;
  const bars = useMemo(() => strengthVolumeHeights(data?.daily ?? []), [data?.daily]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{data?.name || 'Прогрес вправи'}</Text>
      <View style={styles.row}>
        {(['7d', '30d', '90d'] as const).map((period) => (
          <Pressable key={period} accessibilityRole="button" accessibilityState={{ selected: period === range }} onPress={() => setRange(period)} style={styles.chip}>
            <Text style={styles.text}>{period}</Text>
          </Pressable>
        ))}
      </View>
      {progress.isPending ? <ActivityIndicator accessibilityLabel="Завантаження прогресу вправи" /> : null}
      {progress.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void progress.refetch()}>
          <Text accessibilityRole="alert" style={styles.error}>{progress.error.message} Повторити</Text>
        </Pressable>
      ) : null}
      {data ? (
        <>
          <Text style={styles.metric}>Підходів: {data.completedSets}</Text>
          <Text style={styles.metric}>Повторень: {data.strengthReps}</Text>
          <Text style={styles.metric}>Найкраща вага: {data.bestWeightKg ?? '—'} кг</Text>
          <Text style={styles.metric}>Об’єм: {Math.round(data.strengthVolumeKg)} кг</Text>
          {data.daily.some((day) => day.strengthVolumeKg > 0) ? (
            <View style={styles.chart} accessibilityLabel="Щоденний тренувальний об’єм вправи">
              {data.daily.map((day, index) => (
                <View key={day.date} style={styles.day} accessibilityLabel={`${day.date}: ${day.strengthVolumeKg} кг`}>
                  <View style={[styles.bar, { height: `${bars[index] ?? 0}%` }]} />
                </View>
              ))}
            </View>
          ) : <Text style={styles.muted}>За цей період записів ще немає.</Text>}
        </>
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: 14, padding: 24 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 25 },
  metric: { color: palette.text, fontSize: 17 },
  text: { color: palette.text },
  muted: { color: palette.muted },
  error: { color: '#ff6460' },
  row: { flexDirection: 'row', gap: 8 },
  chip: { padding: 10, borderColor: palette.border, borderWidth: 1, borderRadius: 10, minHeight: 44 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: palette.surface, gap: 3, padding: 12, borderRadius: 12 },
  day: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: palette.primary, width: '100%' },
});
