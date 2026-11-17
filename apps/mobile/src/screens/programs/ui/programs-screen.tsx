import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { palette } from '@/shared/config/theme';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

export function ProgramsScreen() {
  const router = useRouter();
  const query = useProgramAssignments();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мої програми</Text>
      <Text style={styles.muted}>Активні програми, призначені тренером</Text>
      {query.isPending ? (
        <AsyncResourceState kind="loading" message="Завантаження програм" />
      ) : null}
      {query.isError ? (
        <AsyncResourceState
          kind="error"
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {!query.isPending && !query.isError && query.data?.data.length === 0 ? (
        <AsyncResourceState kind="empty" message="Активних призначень немає." />
      ) : null}
      {query.data?.meta.totalPages && query.data.meta.totalPages > 1 ? (
        <Text style={styles.muted}>Показано перші 20 призначень.</Text>
      ) : null}
      {query.data?.data.map((assignment) => (
        <Pressable
          key={assignment.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/programs/[id]', params: { id: assignment.id } })}
          style={styles.card}
        >
          <Text style={styles.heading}>{assignment.version.title}</Text>
          <Text style={styles.muted}>
            Версія {assignment.version.version} · {assignment.status}
          </Text>
        </Pressable>
      ))}
      <Pressable
        testID="programs-refresh"
        accessibilityRole="button"
        disabled={query.isFetching}
        accessibilityState={{ disabled: query.isFetching }}
        onPress={() => void query.refetch()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Оновити програми</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 14 },
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
