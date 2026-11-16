import { useRef } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  useCreateWorkoutFromProgram,
  useProgramAssignment,
} from '@/features/programs/model/program-assignments-query';
import { palette } from '@/shared/config/theme';

export function ProgramDetailsScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useProgramAssignment(id);
  const create = useCreateWorkoutFromProgram(id);
  const submitLock = useRef(false);
  const scheduleWorkout = (programWorkoutId: string) => {
    // Blocking inside the event protects against two presses before React rerenders.
    if (submitLock.current || create.isPending) return;
    submitLock.current = true;
    create.mutate(programWorkoutId, {
      onSuccess: (result) =>
        router.push({ pathname: '/workouts/[id]', params: { id: result.id } }),
      onSettled: () => {
        submitLock.current = false;
      },
    });
  };
  const assignment = query.data;
  const workouts =
    assignment && 'workouts' in assignment.version ? assignment.version.workouts : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {query.isPending ? <ActivityIndicator accessibilityLabel="Завантаження програми" /> : null}
      {query.isError ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {query.error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => void query.refetch()}
          >
            <Text style={styles.buttonText}>Повторити завантаження</Text>
          </Pressable>
        </>
      ) : null}
      {assignment ? (
        <>
          <Text style={styles.title}>{assignment.version.title}</Text>
          <Text style={styles.muted}>{assignment.version.description}</Text>
          <Text style={styles.muted}>Призначення: {assignment.status}</Text>
          {workouts.map((workout) => (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.heading}>{workout.title}</Text>
              <Text style={styles.muted}>
                Тиждень {workout.weekNumber} · день {workout.dayNumber}
              </Text>
              {assignment.status === 'ACTIVE' ? (
                <Pressable
                  testID={`program-create-workout-${workout.id}`}
                  accessibilityRole="button"
                  disabled={create.isPending}
                  onPress={() => scheduleWorkout(workout.id)}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>
                    {create.isPending ? 'Створюємо…' : 'Запланувати тренування'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {workouts.length === 0 ? (
            <Text style={styles.muted}>У цій програмі ще немає тренувань.</Text>
          ) : null}
        </>
      ) : null}
      {create.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {create.error.message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: palette.text },
  heading: { fontSize: 17, fontWeight: '600', color: palette.text },
  muted: { color: palette.muted, fontSize: 14 },
  error: { color: '#ff6460', fontSize: 14 },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  button: {
    backgroundColor: palette.primary,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: palette.surface, fontWeight: '700' },
});
