import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { uniqueAssignments } from '@/features/programs/lib/assignment-pagination';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { palette } from '@/shared/config/theme';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

function EmptyAssignedPrograms() {
  return <AsyncResourceState kind="empty" message="Активних призначень немає." />;
}

export function ProgramsScreen() {
  const router = useRouter();
  const query = useProgramAssignments();
  const pages = query.data?.pages;
  const assignments = useMemo(() => uniqueAssignments(pages ?? []), [pages]);
  const initialError = query.isError && !query.data;
  const loading = query.isPending;
  const fetching = query.isFetching;
  const canLoadMore = query.hasNextPage && !fetching;
  const showEmpty = !loading && !query.isError && assignments.length === 0;

  const refresh = () => {
    if (!fetching) void query.refetch();
  };

  const loadMore = () => {
    if (canLoadMore) void query.fetchNextPage();
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={assignments}
      keyExtractor={(item) => item.id}
      bounces={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Мої програми</Text>
          <Text style={styles.muted}>Активні програми, призначені тренером</Text>
          {loading ? <AsyncResourceState kind="loading" message="Завантаження програм" /> : null}
          {initialError ? (
            <AsyncResourceState
              kind="error"
              message={query.error?.message ?? 'Не вдалося завантажити програми.'}
              onRetry={refresh}
              retrying={fetching}
            />
          ) : null}
          {query.isRefetchError && query.data ? (
            <AsyncResourceState
              kind="error"
              message="Не вдалося оновити програми. Показано попередні дані."
              retryLabel="Повторити оновлення"
              onRetry={refresh}
              retrying={fetching}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={showEmpty ? EmptyAssignedPrograms : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Відкрити програму ${item.version.title}`}
          onPress={() => router.push({ pathname: '/programs/[id]', params: { id: item.id } })}
          style={styles.card}
        >
          <Text style={styles.heading}>{item.version.title}</Text>
          <Text style={styles.muted}>
            Версія {item.version.version} · {item.status}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {query.isFetchNextPageError && query.hasNextPage ? (
            <AsyncResourceState
              kind="error"
              message="Не вдалося завантажити наступну сторінку програм."
              retryLabel="Повторити сторінку"
              onRetry={loadMore}
              retrying={fetching}
            />
          ) : null}
          {query.hasNextPage && !query.isFetchNextPageError ? (
            <Pressable
              testID="programs-load-more"
              accessibilityRole="button"
              accessibilityLabel="Показати більше програм"
              accessibilityState={{ disabled: !canLoadMore }}
              disabled={!canLoadMore}
              onPress={loadMore}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {query.isFetchingNextPage ? 'Завантаження…' : 'Показати більше програм'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="programs-refresh"
            accessibilityRole="button"
            accessibilityLabel="Оновити програми"
            accessibilityState={{ disabled: fetching }}
            disabled={fetching}
            onPress={refresh}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Оновити програми</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 14 },
  header: { gap: 12 },
  footer: { gap: 10 },
  title: { fontSize: 26, color: palette.text, fontWeight: '700' },
  heading: { fontSize: 17, color: palette.text, fontWeight: '600' },
  muted: { fontSize: 14, color: palette.muted },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 18,
    gap: 8,
  },
  button: {
    backgroundColor: palette.primary,
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: palette.surface, fontWeight: '700' },
});
