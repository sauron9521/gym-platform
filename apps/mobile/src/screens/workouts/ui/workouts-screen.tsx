import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import type { WorkoutState } from '@/features/workouts/lib/workout-presentation';
import { useWorkoutsQuery, type WorkoutFilter } from '@/features/workouts/model/workouts-query';
import { createThemedStyles } from '@/shared/config/theme-provider';
import {
  MobileAccessDeniedError,
  MobileReadHttpError,
  MobileSessionExpiredError,
} from '@/shared/api/api-error-policy';

export function WorkoutsScreen() {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string>) =>
    intl.formatMessage({ id: `mobile.workoutList.${key}` }, values);
  const filters: { title: string; value: WorkoutFilter }[] = [
    { title: t('all'), value: undefined },
    { title: t('planned'), value: 'PLANNED' },
    { title: t('active'), value: 'IN_PROGRESS' },
    { title: t('completed'), value: 'COMPLETED' },
    { title: t('cancelled'), value: 'CANCELLED' },
  ];
  const statusKeys = {
    PLANNED: 'statusPlanned',
    IN_PROGRESS: 'statusActive',
    COMPLETED: 'statusCompleted',
    CANCELLED: 'statusCancelled',
  } as const satisfies Record<WorkoutState, string>;
  const router = useRouter();
  const { capabilities } = useAuth();
  const [filter, setFilter] = useState<WorkoutFilter>(undefined);
  const {
    data,
    isPending,
    isError,
    error,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useWorkoutsQuery(filter);
  const getErrorKey = (): string => {
    if (error instanceof MobileSessionExpiredError) return 'errorSessionExpired';
    if (error instanceof MobileAccessDeniedError) return 'errorForbidden';
    if (error instanceof MobileReadHttpError) {
      if (error.status === 403) return 'errorForbidden';
      if (error.status === 429) return 'errorRateLimited';
      if (error.status >= 500) return 'errorUnavailable';
    }
    return 'errorDefault';
  };
  const workouts = useMemo(() => {
    const items: { id: string; title: string; status: WorkoutState; scheduledAt: string | null }[] =
      [];
    const seen = new Set<string>();
    for (const page of data?.pages ?? []) {
      for (const item of page.data) {
        // Offset pagination can repeat rows when another device creates a workout.
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push({
          id: item.id,
          title: item.title,
          status: item.status,
          scheduledAt: item.scheduledAt,
        });
      }
    }
    return items;
  }, [data]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={workouts}
      keyExtractor={(workout) => workout.id}
      bounces={false}
      onEndReached={() => {
        // Prevent failed-page retry loops and overlapping refresh/page fetches.
        if (hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
      }}
      onEndReachedThreshold={0.45}
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.subtitle}>{t('subtitle')}</Text>
          {hasAthleteAccess(capabilities) ? (
            <Pressable
              testID="workouts-create"
              accessibilityRole="button"
              accessibilityLabel={t('createAria')}
              style={styles.button}
              onPress={() => router.push('/workouts/new')}
            >
              <Text style={styles.buttonText}>{t('create')}</Text>
            </Pressable>
          ) : null}
          {hasAthleteAccess(capabilities) ? (
            <Pressable
              testID="workouts-programs"
              accessibilityRole="button"
              style={styles.moreButton}
              onPress={() => router.push('/programs')}
            >
              <Text style={styles.subtitle}>
                {intl.formatMessage({ id: 'mobile.tabs.myPrograms' })}
              </Text>
            </Pressable>
          ) : null}
          {hasAthleteAccess(capabilities) ? (
            <Pressable
              testID="workouts-calendar"
              accessibilityRole="button"
              style={styles.moreButton}
              onPress={() => router.push('/workouts/calendar')}
            >
              <Text style={styles.subtitle}>
                {intl.formatMessage({ id: 'mobile.navigation.workoutCalendar' })}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.filters}>
            {filters.map((choice) => (
              <Pressable
                key={choice.value ?? 'ALL'}
                testID={`workouts-filter-${choice.value ?? 'ALL'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: choice.value === filter }}
                onPress={() => setFilter(choice.value)}
                style={[styles.chip, choice.value === filter && styles.selectedChip]}
              >
                <Text style={[styles.chipText, choice.value === filter && styles.selectedText]}>
                  {choice.title}
                </Text>
              </Pressable>
            ))}
          </View>
          {isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t(getErrorKey())}
            </Text>
          ) : null}
          {isPending ? <Text style={styles.subtitle}>{t('loading')}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !isPending && !isError ? <Text style={styles.subtitle}>{t('empty')}</Text> : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('open', { title: item.title })}
          onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: item.id } })}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.subtitle}>{t(statusKeys[item.status])}</Text>
          {item.scheduledAt ? (
            <Text style={styles.subtitle}>
              {new Intl.DateTimeFormat(intl.locale === 'en' ? 'en-US' : 'uk-UA', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(item.scheduledAt))}
            </Text>
          ) : null}
        </Pressable>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {isFetchingNextPage ? <Text style={styles.subtitle}>{t('nextLoading')}</Text> : null}
          {hasNextPage && !isFetchingNextPage ? (
            <Pressable
              testID="workouts-load-more"
              accessibilityRole="button"
              disabled={isFetching}
              onPress={() => void fetchNextPage()}
              style={styles.moreButton}
            >
              <Text style={styles.subtitle}>
                {isFetchNextPageError ? t('nextError') : t('loadMore')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="workouts-refresh"
            accessibilityRole="button"
            disabled={isFetching}
            onPress={() => void refetch()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{isFetching ? t('refreshing') : t('refresh')}</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { padding: 24, gap: 16 },
    heading: { gap: 12 },
    title: { fontSize: 28, fontWeight: '700', color: palette.text },
    subtitle: { fontSize: 15, color: palette.muted },
    card: {
      backgroundColor: palette.surface,
      padding: 18,
      borderRadius: 14,
      borderColor: palette.border,
      borderWidth: 1,
      gap: 8,
    },
    cardTitle: { fontSize: 18, color: palette.text, fontWeight: '600' },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 16,
      borderColor: palette.border,
      borderWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    selectedChip: { backgroundColor: palette.primary },
    selectedText: { color: palette.primaryForeground },
    chipText: { color: palette.text, fontSize: 13 },
    error: { color: palette.error, fontSize: 14 },
    moreButton: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    footer: { gap: 10 },
    button: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 12,
    },
    buttonText: { fontWeight: '700', color: palette.primaryForeground },
  }),
);
