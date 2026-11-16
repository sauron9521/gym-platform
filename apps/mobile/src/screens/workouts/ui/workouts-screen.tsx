import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { palette } from '@/shared/config/theme';

export function WorkoutsScreen() {
  const { data, isLoading, isError, error, isFetching, refetch } = useWorkoutsQuery();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мої тренування</Text>
      <Text style={styles.subtitle}>Останні тренування з Gym API</Text>

      {isLoading ? <ActivityIndicator accessibilityLabel="Завантаження" /> : null}
      {isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error.message}
        </Text>
      ) : null}

      {!isLoading && !isError && data?.data.length === 0 ? (
        <Text style={styles.subtitle}>Тренувань поки немає.</Text>
      ) : null}

      {data?.data.map((workout) => (
        <View key={workout.id} style={styles.card}>
          <Text style={styles.cardTitle}>{workout.title}</Text>
          <Text style={styles.subtitle}>{workoutStatusLabel(workout.status)}</Text>
          {workout.scheduledAt ? (
            <Text style={styles.subtitle}>
              {new Date(workout.scheduledAt).toLocaleDateString('uk-UA')}
            </Text>
          ) : null}
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        disabled={isFetching}
        onPress={() => void refetch()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{isFetching ? 'Оновлення…' : 'Оновити список'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: palette.text },
  subtitle: { fontSize: 15, color: palette.muted },
  card: {
    backgroundColor: palette.surface,
    padding: 18,
    borderRadius: 14,
    borderColor: palette.border,
    borderWidth: 1,
    gap: 8,
  },
  cardTitle: { fontSize: 18, color: palette.text, fontWeight: '600' },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  buttonText: { fontWeight: '700', color: palette.surface },
});
