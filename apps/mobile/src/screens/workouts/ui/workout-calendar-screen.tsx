import { useEffect, useMemo, useState } from 'react';
import { workoutCalendarStatus, type WorkoutCalendarStatus } from '@gym/domain';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';

import { createThemedStyles } from '@/shared/config/theme-provider';
import {
  MobileAccessDeniedError,
  MobileReadHttpError,
  MobileSessionExpiredError,
} from '@/shared/api/api-error-policy';
import {
  calendarMonthCells,
  calendarWeekCells,
  startCalendarWeek,
  shiftCalendarDays,
  groupScheduledWorkouts,
  localWorkoutDayKey,
  monthOf,
  shiftCalendarMonth,
} from '@/features/workouts/lib/calendar-month';
import {
  CalendarDataError,
  useWorkoutCalendarQuery,
} from '@/features/workouts/model/workout-calendar-query';

const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const statusKeys = {
  PLANNED: 'statusPlanned',
  IN_PROGRESS: 'statusActive',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
  MISSED: 'statusMissed',
  COMPLETED_LATE: 'statusCompletedLate',
} as const;
const statusMarks = {
  PLANNED: '○',
  IN_PROGRESS: '▶',
  COMPLETED: '✓',
  CANCELLED: '×',
  MISSED: '!',
  COMPLETED_LATE: '✓!',
} as const satisfies Record<WorkoutCalendarStatus, string>;
const statuses = Object.keys(statusMarks) as (keyof typeof statusMarks)[];

export function WorkoutCalendarScreen() {
  const styles = useStyles();
  const intl = useIntl();
  const router = useRouter();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `mobile.calendar.${key}` }, values);
  const [selection, setSelection] = useState(() => {
    const date = new Date();
    return { month: monthOf(date), date };
  });
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const refreshClock = () => setNow(new Date().toISOString());
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshClock();
    }, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshClock();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const statusLabel = (status: WorkoutCalendarStatus) =>
    status === 'MISSED' || status === 'COMPLETED_LATE'
      ? t(statusKeys[status])
      : intl.formatMessage({ id: `mobile.workoutList.${statusKeys[status]}` });
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const { month, date } = selection;
  const weekly = mode === 'week';
  const weekStart = startCalendarWeek(date);
  const query = useWorkoutCalendarQuery(weekly ? { weekStart } : month);
  const cells = useMemo(
    () => (weekly ? calendarWeekCells(date) : calendarMonthCells(month)),
    [weekly, date, month],
  );
  const days = useMemo(
    () =>
      groupScheduledWorkouts(
        query.isError
          ? []
          : (query.data ?? []).map((workout) => ({
              ...workout,
              calendarStatus: workoutCalendarStatus(workout, now),
            })),
      ),
    [query.data, query.isError, now],
  );
  const selected = localWorkoutDayKey(date);
  const locale = intl.locale === 'en' ? 'en-US' : 'uk-UA';
  const formatDay = (value: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(value);
  const weekFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const heading = weekly
    ? `${weekFormat.format(weekStart)} – ${weekFormat.format(shiftCalendarDays(weekStart, 6))}`
    : new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(month.year, month.month, 1),
      );
  const changePeriod = (delta: number) =>
    setSelection((current) => {
      if (weekly) {
        const nextDate = shiftCalendarDays(current.date, delta * 7);
        return { date: nextDate, month: monthOf(nextDate) };
      }
      const next = shiftCalendarMonth(current.month, delta);
      return { month: next, date: new Date(next.year, next.month, 1) };
    });
  const errorKey = () => {
    if (query.error instanceof CalendarDataError) {
      return t(
        query.error.reason === 'tooMany' ? (weekly ? 'tooManyWeek' : 'tooMany') : 'incomplete',
      );
    }
    const key =
      query.error instanceof MobileAccessDeniedError
        ? 'errorForbidden'
        : query.error instanceof MobileSessionExpiredError
          ? 'errorSessionExpired'
          : query.error instanceof MobileReadHttpError && query.error.status === 429
            ? 'errorRateLimited'
            : query.error instanceof MobileReadHttpError && query.error.status >= 500
              ? 'errorUnavailable'
              : 'errorDefault';
    return intl.formatMessage({ id: `mobile.workoutList.${key}` });
  };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="workout-calendar"
    >
      <Text style={styles.hint}>
        {t('description')} {t('zonePolicy')}
      </Text>
      <View style={styles.modeSwitch}>
        {(['month', 'week'] as const).map((value) => (
          <Pressable
            key={value}
            testID={`calendar-mode-${value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === value }}
            style={[styles.modeButton, mode === value && styles.selected]}
            onPress={() => setMode(value)}
          >
            <Text style={[styles.text, mode === value && styles.selectedText]}>{t(value)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(weekly ? 'previousWeek' : 'previous')}
          testID="calendar-previous"
          style={styles.navButton}
          onPress={() => changePeriod(-1)}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.heading} accessibilityLiveRegion="polite">
          {heading}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(weekly ? 'nextWeek' : 'next')}
          testID="calendar-next"
          style={styles.navButton}
          onPress={() => changePeriod(1)}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        style={styles.secondary}
        testID="calendar-today"
        onPress={() => {
          const today = new Date();
          setSelection({ month: monthOf(today), date: today });
        }}
      >
        <Text style={styles.text}>{t('today')}</Text>
      </Pressable>
      {query.isPending ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {t('loading')}
        </Text>
      ) : null}
      {query.isError ? (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.error}>
            {errorKey()}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
            testID="calendar-retry"
          >
            <Text style={styles.text}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {!query.isPending && !query.isError && query.data ? (
        <>
          <View style={styles.calendar}>
            <View style={styles.week}>
              {weekdays.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {t(day)}
                </Text>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <View key={week} style={styles.week}>
                {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                  const workouts = days.get(cell.key) ?? [];
                  const isSelected = cell.key === selected;
                  const present = statuses.filter((status) =>
                    workouts.some((workout) => workout.calendarStatus === status),
                  );
                  const markers = present.map((status) => statusMarks[status]).join('');
                  const summary = present
                    .map(
                      (status) =>
                        statusLabel(status) +
                        ': ' +
                        workouts.filter((workout) => workout.calendarStatus === status).length,
                    )
                    .join(', ');
                  return (
                    <Pressable
                      key={cell.key}
                      testID={`calendar-day-${cell.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={[
                        t('dayLabel', {
                          date: formatDay(cell.date),
                          count: workouts.length,
                        }),
                        summary,
                      ]
                        .filter(Boolean)
                        .join('. ')}
                      accessibilityState={{ selected: isSelected, disabled: !cell.inMonth }}
                      disabled={!cell.inMonth}
                      style={[styles.day, isSelected && styles.selected]}
                      onPress={() => setSelection({ month: monthOf(cell.date), date: cell.date })}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !cell.inMonth && styles.hint,
                          isSelected && styles.selectedText,
                        ]}
                      >
                        {cell.date.getDate()}
                      </Text>
                      <Text style={[styles.marker, isSelected && styles.selectedText]}>
                        {markers || ' '}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            {Object.entries(statusMarks).map(([status, mark]) => (
              <Text key={status} style={styles.hint}>
                {mark} {statusLabel(status as WorkoutCalendarStatus)}
              </Text>
            ))}
          </View>
          {query.data.length === 0 ? (
            <Text style={styles.hint}>{t(weekly ? 'emptyWeek' : 'emptyMonth')}</Text>
          ) : null}
          {weekly ? (
            <Text style={styles.heading} testID="calendar-week-agenda">
              {t('weekAgenda')}
            </Text>
          ) : null}
          {(weekly ? cells : [{ date, key: selected }]).map((day) => {
            const workouts = days.get(day.key) ?? [];
            return (
              <View
                key={day.key}
                testID={`calendar-agenda-${day.key}`}
                style={[styles.agendaDay, weekly && day.key === selected && styles.agendaSelected]}
              >
                <Text style={styles.heading} accessibilityLiveRegion={weekly ? 'none' : 'polite'}>
                  {formatDay(day.date)}
                </Text>
                {workouts.length === 0 ? <Text style={styles.hint}>{t('emptyDay')}</Text> : null}
                {workouts.map((workout) => (
                  <Pressable
                    key={workout.id}
                    style={styles.card}
                    accessibilityRole="button"
                    accessibilityLabel={intl.formatMessage(
                      { id: 'mobile.workoutList.open' },
                      { title: workout.title },
                    )}
                    onPress={() =>
                      router.push({ pathname: '/workouts/[id]', params: { id: workout.id } })
                    }
                  >
                    <Text style={styles.cardTitle}>{workout.title}</Text>
                    <Text style={styles.hint}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(workout.scheduledAt))}
                      {' · '}
                      {statusLabel(workout.calendarStatus)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            testID="calendar-refresh"
            style={styles.secondary}
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            <Text style={styles.text}>{t(query.isFetching ? 'loading' : 'refresh')}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { padding: 12, gap: 16, paddingBottom: 32 },
    navigation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    modeSwitch: { flexDirection: 'row', gap: 8 },
    modeButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 8,
    },
    agendaDay: { gap: 8, paddingVertical: 8 },
    agendaSelected: { borderLeftWidth: 3, borderLeftColor: palette.primary, paddingLeft: 8 },
    heading: { flexShrink: 1, fontSize: 18, fontWeight: '700', color: palette.text },
    navButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    navText: { fontSize: 26, color: palette.text },
    calendar: { gap: 2 },
    week: { flexDirection: 'row' },
    weekday: { flex: 1, textAlign: 'center', color: palette.muted, fontSize: 12 },
    day: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 2,
    },
    dayText: { fontSize: 14, fontWeight: '600', color: palette.text },
    selected: { backgroundColor: palette.primary, borderColor: palette.primary },
    selectedText: { color: palette.primaryForeground },
    marker: { color: palette.primary, fontSize: 10 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      backgroundColor: palette.surface,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      gap: 6,
    },
    cardTitle: { color: palette.text, fontWeight: '700', fontSize: 16 },
    text: { color: palette.text, fontWeight: '600' },
    hint: { color: palette.muted, fontSize: 13 },
    error: { color: palette.error, fontSize: 14 },
    secondary: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      padding: 10,
    },
  }),
);
