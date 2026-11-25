import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useExercisesQuery } from '@/features/exercises/model/exercises-query';
import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

type Props = {
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

type RememberedSelection = {
  id: string;
  name: string;
};

/**
 * OVRANTO exercise selection keeps the parent workout form compact.
 * Account-scoped results are searched and paginated in a virtualized modal.
 * The parent remains the source of truth for the selected exercise ID.
 */
export function ExercisePicker({ selectedId, disabled = false, onSelect }: Props) {
  const styles = useStyles();
  const { palette } = useMobileTheme();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [remembered, setRemembered] = useState<RememberedSelection | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const query = useExercisesQuery({ search });
  const isSearching = input.trim() !== search;
  const initialError = query.isError && !query.data;
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

  const selectedName = selectedId
    ? (entries.find((exercise) => exercise.id === selectedId)?.name ??
      (remembered?.id === selectedId ? remembered.name : 'Вправу обрано'))
    : null;
  const visibleEntries = isSearching || initialError ? [] : entries;

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setInput('');
    setSearch('');
  };

  const chooseExercise = (id: string, name: string) => {
    if (disabled) return;
    setRemembered({ id, name });
    close();
    onSelect(id);
  };

  return (
    <View style={styles.container}>
      <Pressable
        testID="workout-exercise-open"
        accessibilityRole="button"
        accessibilityLabel={selectedName ? 'Змінити вправу: ' + selectedName : 'Обрати вправу'}
        accessibilityState={{ disabled }}
        accessibilityHint="Відкриває пошук і вибір вправ"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, selectedName && styles.selectedTrigger]}
      >
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerCaption}>ВПРАВА</Text>
          <Text style={selectedName ? styles.selectedText : styles.text}>
            {selectedName ?? 'Обрати вправу'}
          </Text>
          <Text style={styles.hint}>Натисніть, щоб відкрити каталог вправ</Text>
        </View>
        <Text style={styles.chevron} accessibilityElementsHidden>
          ›
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
        accessibilityViewIsModal
      >
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>OVRANTO / КАТАЛОГ</Text>
              <Text style={styles.heading}>Вибір вправи</Text>
              <Text style={styles.hint}>Знайдіть вправу для тренування</Text>
            </View>
            <Pressable
              testID="workout-exercise-close"
              accessibilityRole="button"
              accessibilityLabel="Закрити вибір вправи"
              style={styles.close}
              onPress={close}
            >
              <Text style={styles.closeText}>Закрити</Text>
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
            returnKeyType="search"
            style={styles.input}
          />

          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={visibleEntries}
            keyExtractor={(exercise) => exercise.id}
            initialNumToRender={12}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
            ListEmptyComponent={
              isSearching ? (
                <Text style={styles.feedback}>Шукаємо вправи…</Text>
              ) : query.isPending ? (
                <AsyncResourceState kind="loading" message="Завантаження вправ" />
              ) : initialError ? (
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
            renderItem={({ item }) => {
              const selected = selectedId === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => chooseExercise(item.id, item.name)}
                  style={[styles.exercise, selected && styles.selectedExercise]}
                >
                  <Text style={selected ? styles.selectedExerciseText : styles.exerciseText}>
                    {item.name}
                  </Text>
                  {selected ? (
                    <Text style={styles.checkmark} accessibilityElementsHidden>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
            ListFooterComponent={
              !isSearching && !query.isPending && !initialError && query.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Показати більше вправ"
                  accessibilityState={{ disabled: disabled || query.isFetching }}
                  testID="workout-exercises-next"
                  disabled={disabled || query.isFetching}
                  style={styles.moreButton}
                  onPress={() => void query.fetchNextPage()}
                >
                  <Text style={styles.moreText}>
                    {query.isFetchingNextPage
                      ? 'Завантаження…'
                      : query.isFetchNextPageError
                        ? 'Помилка сторінки. Спробувати ще'
                        : 'Показати більше вправ'}
                  </Text>
                </Pressable>
              ) : undefined
            }
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { gap: 8 },
    trigger: {
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 14,
      backgroundColor: palette.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    selectedTrigger: { borderColor: palette.primary },
    triggerCopy: { flex: 1, gap: 4 },
    triggerCaption: { color: palette.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    text: { color: palette.text, fontSize: 16, fontWeight: '600' },
    selectedText: { color: palette.primary, fontSize: 16, fontWeight: '700' },
    hint: { color: palette.muted, fontSize: 13 },
    chevron: { color: palette.primary, fontSize: 28 },
    modal: { flex: 1, backgroundColor: palette.background, paddingTop: 20 },
    headingRow: {
      paddingHorizontal: 20,
      paddingBottom: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headingCopy: { flex: 1, gap: 5 },
    eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    heading: { fontSize: 24, fontWeight: '700', color: palette.text, flexShrink: 1 },
    close: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    closeText: { color: palette.text, fontSize: 14, fontWeight: '600' },
    input: {
      color: palette.text,
      borderColor: palette.border,
      borderWidth: 1,
      backgroundColor: palette.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      minHeight: 50,
      marginHorizontal: 20,
      marginBottom: 14,
    },
    list: { flex: 1 },
    listContent: { gap: 10, paddingHorizontal: 20, paddingBottom: 48, flexGrow: 1 },
    feedback: { color: palette.muted, textAlign: 'center', paddingVertical: 20, fontSize: 14 },
    exercise: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 14,
      minHeight: 54,
    },
    selectedExercise: {
      borderColor: palette.primary,
      backgroundColor: palette.primary,
    },
    exerciseText: { color: palette.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    selectedExerciseText: {
      color: palette.primaryForeground,
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
    },
    checkmark: { color: palette.primaryForeground, fontSize: 18, fontWeight: '700' },
    moreButton: {
      minHeight: 48,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    moreText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  }),
);
