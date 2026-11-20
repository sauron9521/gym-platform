import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import {
  workoutStatusLabel,
  type WorkoutState,
} from '@/features/workouts/lib/workout-presentation';
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
  const { capabilities } = useAuth();
  const [filter, setFilter] = useState<WorkoutFilter>(undefined);
  const {
    data,
    isPending,
    isError,
    error,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useWorkoutsQuery(filter);
  const workouts = useMemo(() => {
    const items: { id: string; title: string; status: WorkoutState; scheduledAt: string | null }[] =
      [];
    const seen = new Set<string>();
    for (const page of data?.pages ?? []) {
      for (const item of page.data) {
        // Offset pagination can repeat rows when another device creates a workout.
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push({
          id: item.id,
          title: item.title,
          status: item.status,
          scheduledAt: item.scheduledAt,
        });
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
      bounces={false}
      onEndReached={() => {
        // Prevent failed-page retry loops and overlapping refresh/page fetches.
        if (hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
      }}
      onEndReachedThreshold={0.45}
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>Мої тренування</Text>
          <Text style={styles.subtitle}>Історія та заплановані тренування</Text>
          {hasAthleteAccess(capabilities) ? (
            <Pressable
              testID="workouts-create"
              accessibilityRole="button"
              accessibilityLabel="Створити тренування"
              style={styles.button}
              onPress={() => router.push('/workouts/new')}
            >
              <Text style={styles.buttonText}>Нове тренування</Text>
            </Pressable>
          ) : null}
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
          {hasNextPage && !isFetchingNextPage ? (
            <Pressable
              testID="workouts-load-more"
              accessibilityRole="button"
              disabled={isFetching}
              onPress={() => void fetchNextPage()}
              style={styles.moreButton}
            >
              <Text style={styles.subtitle}>
                {isFetchNextPageError ? 'Помилка завантаження. Спробувати ще' : 'Показати ще'}
              </Text>
            </Pressable>
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
  error: { color: '#ff6460', fontSize: 14 },
  moreButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
