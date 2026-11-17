import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { palette } from '@/shared/config/theme';

export function ProgramsScreen() {
  const router = useRouter();
  const query = useProgramAssignments();
  const assignments = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((page) => page.data).filter((assignment) => {
      if (seen.has(assignment.id)) return false;
      seen.add(assignment.id);
      return true;
    });
  }, [query.data]);
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={assignments}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Мої програми</Text>
          <Text style={styles.muted}>Активні програми, призначені тренером</Text>
          {query.isPending ? <Text style={styles.muted}>Завантаження програм…</Text> : null}
          {query.isError ? <Text accessibilityRole="alert" style={styles.error}>{query.error.message}</Text> : null}
        </View>
      }
      ListEmptyComponent={!query.isPending && !query.isError ? <Text style={styles.muted}>Активних призначень немає.</Text> : null}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/programs/[id]', params: { id: item.id } })}
          style={styles.card}
        >
          <Text style={styles.heading}>{item.version.title}</Text>
          <Text style={styles.muted}>Версія {item.version.version} · {item.status}</Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {query.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              disabled={query.isFetching}
              onPress={() => void query.fetchNextPage()}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{query.isFetchingNextPage ? 'Завантаження…' : 'Показати більше програм'}</Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="programs-refresh"
            accessibilityRole="button"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
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
  title: { fontSize: 26, color: palette.text, fontWeight: '700' },
  heading: { fontSize: 17, color: palette.text, fontWeight: '600' },
  muted: { fontSize: 14, color: palette.muted },
  error: { fontSize: 14, color: '#ff6460' },
  card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 18, gap: 8 },
  footer: { gap: 10 },
  button: { backgroundColor: palette.primary, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: palette.surface, fontWeight: '700' },
});
