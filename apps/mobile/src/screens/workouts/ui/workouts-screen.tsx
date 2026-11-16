import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { workoutStatusLabel, type WorkoutState } from '@/features/workouts/lib/workout-presentation';
import { useWorkoutsQuery, type WorkoutFilter } from '@/features/workouts/model/workouts-query';
import { palette } from '@/shared/config/theme';

const filters: { title: string; value: WorkoutFilter }[] = [
  { title: 'Усі', value: undefined },
  { title: 'Заплановано', value: 'PLANNED' },
  { title: 'Триває', value: 'IN_PROGRESS' },
  { title: 'Завершено', value: 'COMPLETED' },
  { title: 'Скасовано', value: 'CANCELLED' },
];

export function WorkoutsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<WorkoutFilter>(undefined);
  const {
    data,
    isPending,
    isError,
    error,
    isFetching,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useWorkoutsQuery(filter);
  const workouts = useMemo(() => {
    const items: { id: string; title: string; status: WorkoutState; scheduledAt: string | null }[] = [];
    for (const page of data?.pages ?? []) {
      for (const item of page.data) {
        items.push({ id: item.id, title: item.title, status: item.status, scheduledAt: item.scheduledAt });
      }
    }
    return items;
  }, [data]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={workouts}
      keyExtractor={(workout) => workout.id}
      refreshing={isRefetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.45}
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>Мої тренування</Text>
          <Text style={styles.subtitle}>Історія та заплановані тренування</Text>
          <View style={styles.filters}>
            {filters.map((choice) => (
              <Pressable
                key={choice.title}
                testID={`workouts-filter-${choice.value ?? 'ALL'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: choice.value === filter }}
                onPress={() => setFilter(choice.value)}
                style={[styles.chip, choice.value === filter && styles.selectedChip]}
              >
                <Text style={styles.chipText}>{choice.title}</Text>
              </Pressable>
            ))}
          </View>
          {isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error.message}
            </Text>
          ) : null}
          {isPending ? <Text style={styles.subtitle}>Завантаження…</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !isPending && !isError ? (
          <Text style={styles.subtitle}>Тренувань за вибраним фільтром немає.</Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Відкрити тренування ${item.title}`}
          onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: item.id } })}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.subtitle}>{workoutStatusLabel(item.status)}</Text>
          {item.scheduledAt ? (
            <Text style={styles.subtitle}>
              {new Date(item.scheduledAt).toLocaleDateString('uk-UA')}
            </Text>
          ) : null}
        </Pressable>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {isFetchingNextPage ? (
            <Text style={styles.subtitle}>Завантаження наступної сторінки…</Text>
          ) : null}
          <Pressable
            testID="workouts-refresh"
            accessibilityRole="button"
            disabled={isFetching}
            onPress={() => void refetch()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{isFetching ? 'Оновлення…' : 'Оновити список'}</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  heading: { gap: 12 },
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 16,
    borderColor: palette.border,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  selectedChip: { backgroundColor: palette.primary },
  chipText: { color: palette.text, fontSize: 13 },
  error: { color: '#b91c1c', fontSize: 14 },
  footer: { gap: 10 },
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
