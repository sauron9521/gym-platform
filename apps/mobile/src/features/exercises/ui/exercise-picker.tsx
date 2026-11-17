import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { palette } from '@/shared/config/theme';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

type Props = {
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/**
 * Searches the account-scoped exercise library across all available pages.
 * Keep selection in the owning form, not inside the picker.
 */
export function ExercisePicker({ selectedId, disabled = false, onSelect }: Props) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const query = useExercisesQuery({ search });
  const isSearching = input.trim() !== search;
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return (
      query.data?.pages.flatMap((page) =>
        page.data.filter((exercise) => {
          if (exercise.isArchived || seen.has(exercise.id)) return false;
          seen.add(exercise.id);
          return true;
        }),
      ) ?? []
    );
  }, [query.data]);
  const visibleEntries = isSearching || query.isError ? [] : entries;

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Пошук вправи"
        testID="workout-exercise-search"
        placeholder="Знайти вправу…"
        placeholderTextColor={palette.muted}
        value={input}
        onChangeText={setInput}
        maxLength={100}
        editable={!disabled}
        autoCorrect={false}
        style={styles.input}
      />
      {isSearching ? <Text style={styles.muted}>Шукаємо вправи…</Text> : null}
      {!isSearching && query.isPending ? (
        <AsyncResourceState kind="loading" message="Завантаження вправ" />
      ) : null}
      {!isSearching && query.isError ? (
        <AsyncResourceState
          kind="error"
          message={query.error.message}
          retrying={disabled || query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!isSearching &&
      !query.isPending &&
      !query.isError &&
      visibleEntries.length === 0 &&
      !query.hasNextPage ? (
        <AsyncResourceState kind="empty" message="Вправ не знайдено." />
      ) : null}

      {visibleEntries.map((exercise) => (
        <Pressable
          key={exercise.id}
          accessibilityRole="button"
          accessibilityLabel={exercise.name}
          accessibilityState={{ selected: selectedId === exercise.id, disabled }}
          disabled={disabled}
          onPress={() => onSelect(exercise.id)}
          style={[styles.exercise, selectedId === exercise.id && styles.selected]}
        >
          <Text style={styles.text}>{exercise.name}</Text>
        </Pressable>
      ))}

      {!isSearching && !query.isPending && !query.isError && query.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Показати більше вправ"
          accessibilityState={{ disabled: disabled || query.isFetching }}
          testID="workout-exercises-next"
          disabled={disabled || query.isFetching}
          style={styles.exercise}
          onPress={() => void query.fetchNextPage()}
        >
          <Text style={styles.text}>
            {query.isFetchingNextPage
              ? 'Завантаження…'
              : query.isFetchNextPageError
                ? 'Помилка сторінки. Спробувати ще'
                : 'Показати більше вправ'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: {
    color: palette.text,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  exercise: {
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  selected: { borderColor: palette.primary, borderWidth: 2 },
  text: { color: palette.text, fontSize: 15 },
  muted: { color: palette.muted },
});
