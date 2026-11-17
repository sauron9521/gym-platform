import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { useWorkoutSummary } from '@/features/progress/model/workout-summary-query';
import { workoutStatusLabel } from '@/features/workouts/lib/workout-presentation';
import { useWorkoutsQuery } from '@/features/workouts/model/workouts-query';
import { palette } from '@/shared/config/theme';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

/**
 * Workout and progress API endpoints require an athlete role. Mount queries
 * only inside this component to avoid unauthorized trainer/admin requests.
 */
function AthleteDashboard() {
  const router = useRouter();
  const workouts = useWorkoutsQuery();
  const programs = useProgramAssignments();
  const summary = useWorkoutSummary('7d');

  // Gym API returns the first page newest-first (createdAt desc, id desc).
  const recentWorkouts = workouts.isError ? [] : workouts.data?.pages[0]?.data.slice(0, 3);
  const recentWorkoutCount = recentWorkouts?.length ?? 0;
  const statsError = summary.isError || programs.isError;
  const statsFetching = summary.isFetching || programs.isFetching;
  const completedCount = summary.data?.workoutCount ?? '—';
  const activeProgramCount = programs.data?.meta.total ?? '—';

  return (
    <>
      <View style={styles.summary} accessibilityLabel="Підсумок активності">
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {summary.isPending || summary.isError ? '—' : completedCount}
          </Text>
          <Text style={styles.subtitle}>Завершено тренувань за 7 днів</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {programs.isPending || programs.isError ? '—' : activeProgramCount}
          </Text>
          <Text style={styles.subtitle}>Активних призначених програм</Text>
        </View>
      </View>

      {summary.isPending || programs.isPending ? (
        <Text style={styles.subtitle}>Завантаження статистики…</Text>
      ) : null}
      {statsError ? (
        <AsyncResourceState
          kind="error"
          message="Не вдалося завантажити частину статистики."
          retrying={statsFetching}
          onRetry={() => {
            if (summary.isError) void summary.refetch();
            if (programs.isError) void programs.refetch();
          }}
        />
      ) : null}

      <Text style={styles.heading}>Останні тренування</Text>
      {workouts.isPending ? (
        <AsyncResourceState kind="loading" message="Завантаження тренувань" />
      ) : null}
      {workouts.isError ? (
        <AsyncResourceState
          kind="error"
          message={workouts.error.message}
          retrying={workouts.isFetching}
          onRetry={() => void workouts.refetch()}
        />
      ) : null}
      {!workouts.isPending && !workouts.isError && recentWorkoutCount === 0 ? (
        <AsyncResourceState kind="empty" message="Тренувань ще немає. Створіть перше!" />
      ) : null}
      {recentWorkouts?.map((workout) => (
        <Pressable
          key={workout.id}
          accessibilityRole="button"
          accessibilityLabel={`Відкрити тренування ${workout.title}`}
          style={styles.action}
          onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: workout.id } })}
        >
          <Text style={styles.actionText}>{workout.title}</Text>
          <Text style={styles.subtitle}>{workoutStatusLabel(workout.status)}</Text>
        </Pressable>
      ))}
    </>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const isAthlete = account?.role === 'ATHLETE';
  const displayName = account?.profile?.displayName?.trim() || account?.profile?.firstName?.trim();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLabel="Головна Gym Platform"
    >
      <Text style={styles.eyebrow}>GYM PLATFORM</Text>
      <Text style={styles.title}>
        {displayName ? `Вітаємо, ${displayName}!` : 'Вітаємо у Gym Platform!'}
      </Text>
      <Text style={styles.subtitle}>
        {isAthlete
          ? 'Ваші тренування та прогрес в одному місці.'
          : 'Відкрийте доступні розділи платформи.'}
      </Text>

      <Text style={styles.heading}>Швидкі дії</Text>
      {isAthlete ? (
        <Pressable
          testID="home-create-workout"
          accessibilityRole="button"
          accessibilityLabel="Створити тренування"
          style={styles.primary}
          onPress={() => router.push('/workouts/new')}
        >
          <Text style={styles.primaryText}>Створити тренування</Text>
        </Pressable>
      ) : null}
      {isAthlete ? (
        <Pressable
          testID="home-all-workouts"
          accessibilityRole="button"
          accessibilityLabel="Мої тренування"
          style={styles.action}
          onPress={() => router.push('/workouts')}
        >
          <Text style={styles.actionText}>Мої тренування</Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="home-exercises"
        accessibilityRole="button"
        accessibilityLabel="Каталог вправ"
        style={styles.action}
        onPress={() => router.push('/exercises')}
      >
        <Text style={styles.actionText}>Каталог вправ</Text>
      </Pressable>
      {isAthlete ? (
        <Pressable
          testID="home-progress"
          accessibilityRole="button"
          accessibilityLabel="Мій прогрес"
          style={styles.action}
          onPress={() => router.push('/progress')}
        >
          <Text style={styles.actionText}>Мій прогрес</Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="home-profile"
        accessibilityRole="button"
        accessibilityLabel="Відкрити профіль"
        style={styles.action}
        onPress={() => router.push('/profile')}
      >
        <Text style={styles.actionText}>Відкрити профіль</Text>
      </Pressable>

      {isAthlete ? <AthleteDashboard /> : null}
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
  stat: {
    flex: 1,
    borderRadius: 12,
    borderColor: palette.border,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  statValue: { color: palette.primary, fontWeight: '700', fontSize: 26 },
  action: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 16,
    gap: 5,
    minHeight: 50,
  },
  actionText: { color: palette.text, fontWeight: '600' },
  primary: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    padding: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryText: { color: palette.background, fontWeight: '700' },
});
