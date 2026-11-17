import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { palette } from '@/shared/config/theme';

type Props = {
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/** Search and load the full exercise library instead of offering only the first 20. */
export function ExercisePicker({ selectedId, disabled = false, onSelect }: Props) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const query = useExercisesQuery({ search });
  const entries = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; isArchived: boolean }>();
    for (const page of query.data?.pages ?? []) {
      for (const exercise of page.data) {
        if (!exercise.isArchived) unique.set(exercise.id, exercise);
      }
    }
    return [...unique.values()];
  }, [query.data]);

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Пошук вправи"
        testID="workout-exercise-search"
        placeholder="Знайти вправу…"
        placeholderTextColor={palette.muted}
        value={input}
        onChangeText={setInput}
        editable={!disabled}
        autoCorrect={false}
        style={styles.input}
      />
      {query.isPending ? <ActivityIndicator accessibilityLabel="Завантаження вправ" /> : null}
      {query.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.exercise}>
          <Text style={styles.error}>Не вдалося завантажити вправи. Повторити</Text>
        </Pressable>
      ) : null}
      {!query.isPending && !query.isError && entries.length === 0 ? (
        <Text style={styles.muted}>Вправ не знайдено.</Text>
      ) : null}
      {entries.map((exercise) => (
        <Pressable
          key={exercise.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === exercise.id }}
          disabled={disabled}
          onPress={() => onSelect(exercise.id)}
          style={[styles.exercise, selectedId === exercise.id && styles.selected]}
        >
          <Text style={styles.text}>{exercise.name}</Text>
        </Pressable>
      ))}
      {query.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          testID="workout-exercises-next"
          disabled={disabled || query.isFetchingNextPage}
          style={styles.exercise}
          onPress={() => void query.fetchNextPage()}
        >
          <Text style={styles.text}>{query.isFetchingNextPage ? 'Завантаження…' : 'Показати більше вправ'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: { color: palette.text, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  exercise: { padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, minHeight: 44, justifyContent: 'center' },
  selected: { borderColor: palette.primary, borderWidth: 2 },
  text: { color: palette.text, fontSize: 15 },
  muted: { color: palette.muted },
  error: { color: '#ff6460' },
});
