import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { palette } from '@/shared/config/theme';

export function ProgramsScreen() {
  const router = useRouter();
  const query = useProgramAssignments();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мої програми</Text>
      <Text style={styles.muted}>Активні програми, призначені тренером</Text>
      {query.isPending ? <ActivityIndicator accessibilityLabel="Завантаження програм" /> : null}
      {query.isError ? <Text accessibilityRole="alert" style={styles.error}>{query.error.message}</Text> : null}
      {query.data?.data.length === 0 ? <Text style={styles.muted}>Активних призначень немає.</Text> : null}
      {query.data?.data.map((assignment) => (
        <Pressable
          key={assignment.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/programs/[id]', params: { id: assignment.id } })}
          style={styles.card}
        >
          <Text style={styles.heading}>{assignment.version.title}</Text>
          <Text style={styles.muted}>Версія {assignment.version.version} · {assignment.status}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.button}>
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
  error: { fontSize: 14, color: '#b91c1c' },
  card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 18, gap: 8 },
  button: { backgroundColor: palette.primary, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: palette.surface, fontWeight: '700' },
});
