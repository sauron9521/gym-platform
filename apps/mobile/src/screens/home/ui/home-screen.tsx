import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import { palette } from '@/shared/config/theme';

export function HomeScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const workouts = useWorkoutsQuery();
  const programs = useProgramAssignments();
  const summary = useWorkoutSummary('7d');
  const recentWorkouts = workouts.data?.pages[0]?.data.slice(0, 3) ?? [];
  const isAthlete = account?.role === 'ATHLETE';
  const displayName = account?.profile?.displayName?.trim() || account?.profile?.firstName?.trim() || 'у Gym Platform';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>GYM PLATFORM</Text>
      <Text style={styles.title}>Вітаємо, {displayName}!</Text>
      <Text style={styles.subtitle}>
        {isAthlete ? 'Ваші тренування та прогрес в одному місці.' : 'Переглядайте свій профіль і доступні тренування.'}
      </Text>

      {isAthlete ? (
        <View style={styles.summary} accessibilityLabel="Підсумок активності">
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.isPending ? '…' : (summary.data?.workoutCount ?? '—')}</Text>
            <Text style={styles.subtitle}>Тренувань за 7 днів</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{programs.isPending ? '…' : (programs.data?.data.length ?? '—')}</Text>
            <Text style={styles.subtitle}>Активних програм (завантажено)</Text>
          </View>
        </View>
      ) : null}
      {isAthlete && (summary.isError || programs.isError) ? (
        <Text accessibilityRole="alert" style={styles.error}>Частину статистики не вдалося завантажити. Оновіть сторінку або відкрийте відповідний розділ.</Text>
      ) : null}

      <Text style={styles.heading}>Швидкі дії</Text>
      {isAthlete ? (
        <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push('/workouts/new')}>
          <Text style={styles.primaryText}>Створити тренування</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push('/workouts')}>
        <Text style={styles.actionText}>Мої тренування</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push('/exercises')}>
        <Text style={styles.actionText}>Каталог вправ</Text>
      </Pressable>
      {isAthlete ? (
        <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push('/progress')}>
          <Text style={styles.actionText}>Мій прогрес</Text>
        </Pressable>
      ) : null}

      <Text style={styles.heading}>Останні тренування</Text>
      {workouts.isPending ? <Text style={styles.subtitle}>Завантаження тренувань…</Text> : null}
      {workouts.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void workouts.refetch()}>
          <Text style={styles.error}>Не вдалося завантажити. Повторити</Text>
        </Pressable>
      ) : null}
      {!workouts.isPending && !workouts.isError && recentWorkouts.length === 0 ? (
        <Text style={styles.subtitle}>Тренувань ще немає. Почніть із першого!</Text>
      ) : null}
      {recentWorkouts.map((workout) => (
        <Pressable
          key={workout.id}
          accessibilityRole="button"
          style={styles.action}
          onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: workout.id } })}
        >
          <Text style={styles.actionText}>{workout.title}</Text>
          <Text style={styles.subtitle}>{workoutStatusLabel(workout.status)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 14, paddingBottom: 40 },
  eyebrow: { color: palette.primary, fontWeight: '700', letterSpacing: 2, fontSize: 12 },
  title: { color: palette.text, fontWeight: '700', fontSize: 27 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 19, marginTop: 10 },
  subtitle: { color: palette.muted, fontSize: 14 },
  summary: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  stat: { flex: 1, borderRadius: 12, borderColor: palette.border, borderWidth: 1, padding: 14, gap: 8 },
  statValue: { color: palette.primary, fontWeight: '700', fontSize: 26 },
  action: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 16, gap: 5, minHeight: 50 },
  actionText: { color: palette.text, fontWeight: '600' },
  primary: { backgroundColor: palette.primary, borderRadius: 12, padding: 16, minHeight: 50, justifyContent: 'center' },
  primaryText: { color: palette.background, fontWeight: '700' },
  error: { color: '#ff6460', fontSize: 14 },
});
