import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import { createThemedStyles } from '@/shared/config/theme-provider';
import { workoutSetProgress } from '@gym/domain';
import type { WorkoutDetails } from '@/features/workouts/model/workout-details-query';

type Props = PropsWithChildren<{
  exercise: WorkoutDetails['exercises'][number];
  autoCollapse: boolean;
  active: boolean;
  confirmed: boolean;
}>;

type Disclosure = 'waiting' | 'collapsed' | 'expanded';

/** Local presentation state only. Keep rows mounted so reopening a card
 * does not discard drafts, edit mode or acknowledged set receipts. */
export function WorkoutExerciseCard({
  exercise,
  autoCollapse,
  active,
  confirmed,
  children,
}: Props) {
  const intl = useIntl();
  const styles = useStyles();
  const { completed, skipped, pending } = workoutSetProgress(exercise.sets);
  const total = exercise.sets.length;
  const resolved = total > 0 && pending === 0 && completed + skipped === total;
  const eligible = active && autoCollapse && resolved;
  const [disclosure, setDisclosure] = useState<Disclosure>('waiting');
  // Adjust only on a new eligibility episode or its first safe confirmation.
  // A user's explicit expansion survives unrelated writes and refetches.
  const next = !eligible
    ? 'waiting'
    : disclosure === 'waiting' && confirmed
      ? 'collapsed'
      : disclosure;
  if (next !== disclosure) setDisclosure(next);
  const collapsed = eligible && next === 'collapsed';
  const toggleable = eligible && (collapsed || confirmed);
  const title = exercise.exerciseNameSnapshot;
  const summary = intl.formatMessage(
    { id: 'mobile.workout.exerciseSetSummary' },
    { completed, skipped, total },
  );
  return (
    <View style={styles.card}>
      {eligible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={summary}
          accessibilityState={{ expanded: !collapsed, disabled: !toggleable }}
          disabled={!toggleable}
          testID={`exercise-toggle-${exercise.id}`}
          onPress={() => setDisclosure(collapsed ? 'expanded' : 'collapsed')}
          style={styles.header}
        >
          <View style={styles.headingContent}>
            <Text style={styles.heading}>{title}</Text>
            <Text style={styles.muted}>{summary}</Text>
          </View>
          <Text style={styles.indicator} accessibilityElementsHidden importantForAccessibility="no">
            {collapsed ? '⌄' : '⌃'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.headingContent}>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.muted}>
            {intl.formatMessage({ id: 'mobile.workout.exerciseSetCount' }, { total })}
          </Text>
        </View>
      )}
      <View
        testID={`exercise-sets-${exercise.id}`}
        style={collapsed ? styles.hidden : styles.sets}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 14,
      padding: 18,
      gap: 8,
      minWidth: 0,
    },
    headingContent: { flex: 1, gap: 8 },
    heading: { fontSize: 17, fontWeight: '600', color: palette.text },
    muted: { fontSize: 14, color: palette.muted },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    indicator: { fontSize: 22, color: palette.primary },
    sets: { gap: 8 },
    hidden: { display: 'none' },
  }),
);
