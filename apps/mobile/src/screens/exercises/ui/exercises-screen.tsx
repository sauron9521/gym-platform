import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExerciseFilters, useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { palette } from '@/shared/config/theme';

export function ExercisesScreen() {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `mobile.exerciseCatalog.${key}` });
  const exerciseTypeKey = (type: string) => {
    switch (type) {
      case 'STRENGTH':
        return 'exerciseTypeStrength';
      case 'CARDIO':
        return 'exerciseTypeCardio';
      case 'MOBILITY':
        return 'exerciseTypeMobility';
      case 'PLYOMETRIC':
        return 'exerciseTypePlyometric';
      case 'OTHER':
        return 'exerciseTypeOther';
      default:
        return 'exerciseTypeUnknown';
    }
  };
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();
  // Defer HTTP search requests while the user is still typing.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const query = useExercisesQuery({ search: debouncedSearch, muscleGroup, equipment });
  const filters = useExerciseFilters();
  const exercises = useMemo(() => {
    const seen = new Set<string>();
    return (
      query.data?.pages.flatMap((page) =>
        page.data.filter((exercise) => {
          if (seen.has(exercise.id)) return false;
          seen.add(exercise.id);
          return true;
        }),
      ) ?? []
    );
  }, [query.data]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={exercises}
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        // A failed page should be retried manually, not in an endless FlatList loop.
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      bounces={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{t('title')}</Text>
          <Pressable
            testID="exercises-refresh"
            accessibilityRole="button"
            accessibilityLabel={t('refreshAria')}
            accessibilityState={{ disabled: query.isFetching }}
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
            style={styles.moreButton}
          >
            <Text style={styles.retryText}>
              {query.isFetching ? t('refreshing') : t('refresh')}
            </Text>
          </Pressable>
          <TextInput
            testID="exercise-search"
            accessibilityLabel={t('search')}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            maxLength={100}
            placeholderTextColor={palette.muted}
            style={styles.input}
          />
          <Text style={styles.subtitle}>{t('muscle')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              accessibilityRole="button"
              testID="exercise-muscles-all"
              accessibilityState={{ selected: muscleGroup === undefined }}
              onPress={() => setMuscleGroup(undefined)}
              style={[styles.chip, muscleGroup === undefined && styles.selected]}
            >
              <Text style={styles.chipText}>{t('allMuscles')}</Text>
            </Pressable>
            {filters.muscleGroups.data?.map((group) => (
              <Pressable
                key={group.id}
                testID={`exercise-muscle-${group.slug}`}
                accessibilityRole="button"
                accessibilityState={{ selected: muscleGroup === group.slug }}
                onPress={() => setMuscleGroup(group.slug)}
                style={[styles.chip, muscleGroup === group.slug && styles.selected]}
              >
                <Text style={styles.chipText}>{group.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.subtitle}>{t('equipment')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              accessibilityRole="button"
              testID="exercise-equipment-all"
              accessibilityState={{ selected: equipment === undefined }}
              onPress={() => setEquipment(undefined)}
              style={[styles.chip, equipment === undefined && styles.selected]}
            >
              <Text style={styles.chipText}>{t('allEquipment')}</Text>
            </Pressable>
            {filters.equipment.data?.map((item) => (
              <Pressable
                key={item.id}
                testID={`exercise-equipment-${item.slug}`}
                accessibilityRole="button"
                accessibilityState={{ selected: equipment === item.slug }}
                onPress={() => setEquipment(item.slug)}
                style={[styles.chip, equipment === item.slug && styles.selected]}
              >
                <Text style={styles.chipText}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {filters.muscleGroups.isError ? (
            <View style={styles.errorGroup}>
              <Text accessibilityRole="alert" style={styles.error}>
                {t('muscleError')}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={filters.muscleGroups.isFetching}
                accessibilityState={{ disabled: filters.muscleGroups.isFetching }}
                onPress={() => void filters.muscleGroups.refetch()}
              >
                <Text style={styles.retryText}>{t('retryMuscles')}</Text>
              </Pressable>
            </View>
          ) : null}
          {filters.equipment.isError ? (
            <View style={styles.errorGroup}>
              <Text accessibilityRole="alert" style={styles.error}>
                {t('equipmentError')}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={filters.equipment.isFetching}
                accessibilityState={{ disabled: filters.equipment.isFetching }}
                onPress={() => void filters.equipment.refetch()}
              >
                <Text style={styles.retryText}>{t('retryEquipment')}</Text>
              </Pressable>
            </View>
          ) : null}
          {query.isError ? (
            <View style={styles.errorGroup}>
              <Text accessibilityRole="alert" style={styles.error}>
                {t('catalogError')}
              </Text>
              <Pressable
                testID="exercises-retry"
                accessibilityRole="button"
                disabled={query.isFetching}
                accessibilityState={{ disabled: query.isFetching }}
                onPress={() => void query.refetch()}
              >
                <Text style={styles.retryText}>{t('retry')}</Text>
              </Pressable>
            </View>
          ) : null}
          {query.isPending ? <Text style={styles.subtitle}>{t('loading')}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !query.isPending && !query.isError ? (
          <Text style={styles.subtitle}>{t('empty')}</Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.heading}>{item.name}</Text>
          <Text style={styles.subtitle}>{t(exerciseTypeKey(item.exerciseType))}</Text>
          {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
          <Text style={styles.subtitle}>
            {item.muscleGroups.map((group) => group.muscleGroup.name).join(', ')}
          </Text>
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {query.isFetchingNextPage ? (
            <Text style={styles.subtitle}>{t('nextLoading')}</Text>
          ) : null}
          {query.hasNextPage && !query.isFetchingNextPage ? (
            <Pressable
              testID="exercises-load-more"
              accessibilityRole="button"
              disabled={query.isFetching}
              accessibilityState={{ disabled: query.isFetching }}
              onPress={() => void query.fetchNextPage()}
              style={styles.moreButton}
            >
              <Text style={styles.retryText}>
                {query.isFetchNextPageError ? t('nextError') : t('loadMore')}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
    backgroundColor: palette.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { padding: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 20 },
  selected: { backgroundColor: palette.primary },
  chipText: { color: palette.text, fontSize: 13 },
  card: {
    padding: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    gap: 6,
  },
  error: { color: '#ff6460', fontSize: 14 },
  errorGroup: { gap: 6 },
  retryText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  footer: { gap: 10 },
  moreButton: {
    padding: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
