import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { palette } from '@/shared/config/theme';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

type Props = {
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/**
 * Keep the workout form compact: search and paginated exercise selection live
 * in a modal FlatList, not an unbounded list inside the parent ScrollView.
 */
export function ExercisePicker({ selectedId, disabled = false, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);

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

  const selectedLabel =
    entries.find((exercise) => exercise.id === selectedId)?.name ??
    (selectedId ? selectedName ?? 'Вправу обрано' : 'Обрати вправу');
  const visibleEntries = isSearching || query.isError ? [] : entries;

  const chooseExercise = (id: string, name: string) => {
    setSelectedName(name);
    onSelect(id);
    setInput('');
    setSearch('');
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Pressable
        testID="workout-exercise-open"
        accessibilityRole="button"
        accessibilityLabel="Відкрити вибір вправи"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text style={selectedId ? styles.selectedText : styles.text}>{selectedLabel}</Text>
        <Text style={styles.hint}>Змінити / знайти вправу</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.headingRow}>
            <Text style={styles.heading}>Вибір вправи</Text>
            <Pressable
              testID="workout-exercise-close"
              accessibilityRole="button"
              accessibilityLabel="Закрити вибір вправи"
              style={styles.close}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.text}>Закрити</Text>
            </Pressable>
          </View>
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
            autoFocus
            style={styles.input}
          />
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={visibleEntries}
            keyExtractor={(exercise) => exercise.id}
            initialNumToRender={12}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            ListEmptyComponent={
              isSearching ? (
                <Text style={styles.hint}>Шукаємо вправи…</Text>
              ) : query.isPending ? (
                <AsyncResourceState kind="loading" message="Завантаження вправ" />
              ) : query.isError ? (
                <AsyncResourceState
                  kind="error"
                  message={query.error.message}
                  retrying={disabled || query.isFetching}
                  onRetry={() => void query.refetch()}
                />
              ) : (
                <AsyncResourceState kind="empty" message="Вправ не знайдено." />
              )
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: selectedId === item.id, disabled }}
                disabled={disabled}
                onPress={() => chooseExercise(item.id, item.name)}
                style={[styles.exercise, selectedId === item.id && styles.selected]}
              >
                <Text style={styles.text}>{item.name}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              !isSearching && !query.isPending && !query.isError && query.hasNextPage ? (
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
              ) : null
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  trigger: {
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
    gap: 4,
  },
  text: { color: palette.text, fontSize: 15 },
  selectedText: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  hint: { color: palette.muted, fontSize: 13 },
  modal: { flex: 1, backgroundColor: palette.background, paddingTop: 24 },
  headingRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: { fontSize: 23, fontWeight: '700', color: palette.text, flexShrink: 1 },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  input: {
    color: palette.text,
    borderColor: palette.border,
    borderWidth: 1,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  list: { flex: 1 },
  listContent: { gap: 8, paddingHorizontal: 20, paddingBottom: 48 },
  exercise: {
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  selected: { borderColor: palette.primary, borderWidth: 2 },
});
