import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExerciseFilters, useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { palette } from '@/shared/config/theme';

export function ExercisesScreen() {
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();
  const deferredSearch = useDeferredValue(search.trim());
  const query = useExercisesQuery({ search: deferredSearch, muscleGroup, equipment });
  const filters = useExerciseFilters();
  const exercises = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={exercises}
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Каталог вправ</Text>
          <TextInput
            testID="exercise-search"
            accessibilityLabel="Пошук вправ"
            placeholder="Назва вправи"
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
          <Text style={styles.subtitle}>Група м’язів</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable accessibilityRole="button" onPress={() => setMuscleGroup(undefined)} style={styles.chip}>
              <Text style={styles.chipText}>Усі</Text>
            </Pressable>
            {filters.muscleGroups.data?.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                accessibilityState={{ selected: muscleGroup === group.slug }}
                onPress={() => setMuscleGroup(group.slug)}
                style={[styles.chip, muscleGroup === group.slug && styles.selected]}
              >
                <Text style={styles.chipText}>{group.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.subtitle}>Обладнання</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable accessibilityRole="button" onPress={() => setEquipment(undefined)} style={styles.chip}>
              <Text style={styles.chipText}>Усе</Text>
            </Pressable>
            {filters.equipment.data?.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: equipment === item.slug }}
                onPress={() => setEquipment(item.slug)}
                style={[styles.chip, equipment === item.slug && styles.selected]}
              >
                <Text style={styles.chipText}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {query.isError ? <Text accessibilityRole="alert" style={styles.error}>{query.error.message}</Text> : null}
          {query.isPending ? <Text style={styles.subtitle}>Завантажуємо каталог…</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !query.isPending && !query.isError ? (
          <Text style={styles.subtitle}>За такими фільтрами вправ немає.</Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.heading}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.exerciseType}</Text>
          {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
          <Text style={styles.subtitle}>
            {item.muscleGroups.map((group) => group.muscleGroup.name).join(', ')}
          </Text>
        </View>
      )}
      ListFooterComponent={
        query.isFetchingNextPage ? <Text style={styles.subtitle}>Завантажуємо наступні вправи…</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 12 },
  header: { gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: palette.text },
  heading: { fontSize: 17, fontWeight: '600', color: palette.text },
  subtitle: { color: palette.muted, fontSize: 14 },
  input: { borderWidth: 1, borderColor: palette.border, color: palette.text, backgroundColor: palette.surface, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { padding: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 20 },
  selected: { backgroundColor: palette.primary },
  chipText: { color: palette.text, fontSize: 13 },
  card: { padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, gap: 6 },
  error: { color: '#b91c1c', fontSize: 14 },
});
