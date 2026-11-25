import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { uniqueAssignments } from '@/features/programs/lib/assignment-pagination';
import { useProgramAssignments } from '@/features/programs/model/program-assignments-query';
import { createThemedStyles } from '@/shared/config/theme-provider';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';

function EmptyAssignedPrograms() {
  const intl = useIntl();
  return (
    <AsyncResourceState
      kind="empty"
      message={intl.formatMessage({ id: 'mobile.programList.empty' })}
    />
  );
}

export function ProgramsScreen() {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `mobile.programList.${key}` }, values);
  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return t('statusActive');
      case 'COMPLETED':
        return t('statusCompleted');
      case 'TERMINATED':
        return t('statusTerminated');
      default:
        return t('statusUnknown');
    }
  };
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
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.muted}>{t('description')}</Text>
          {loading ? <AsyncResourceState kind="loading" message={t('loading')} /> : null}
          {initialError ? (
            <AsyncResourceState
              kind="error"
              message={t('loadFailed')}
              retryLabel={t('retryDefault')}
              onRetry={refresh}
              retrying={fetching}
            />
          ) : null}
          {query.isRefetchError && query.data ? (
            <AsyncResourceState
              kind="error"
              message={t('refreshFailed')}
              retryLabel={t('retryRefresh')}
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
          accessibilityLabel={t('open', { title: item.version.title })}
          onPress={() => router.push({ pathname: '/programs/[id]', params: { id: item.id } })}
          style={styles.card}
        >
          <Text style={styles.heading}>{item.version.title}</Text>
          <Text style={styles.muted}>
            {t('version', { version: item.version.version })} · {statusLabel(item.status)}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {query.isFetchNextPageError && query.hasNextPage ? (
            <AsyncResourceState
              kind="error"
              message={t('loadMoreFailed')}
              retryLabel={t('retryPage')}
              onRetry={loadMore}
              retrying={fetching}
            />
          ) : null}
          {query.hasNextPage && !query.isFetchNextPageError ? (
            <Pressable
              testID="programs-load-more"
              accessibilityRole="button"
              accessibilityLabel={t('showMore')}
              accessibilityState={{ disabled: !canLoadMore }}
              disabled={!canLoadMore}
              onPress={loadMore}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {query.isFetchingNextPage ? t('loadingMore') : t('showMore')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="programs-refresh"
            accessibilityRole="button"
            accessibilityLabel={t('refresh')}
            accessibilityState={{ disabled: fetching }}
            disabled={fetching}
            onPress={refresh}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{t('refresh')}</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
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
    buttonText: { color: palette.primaryForeground, fontWeight: '700' },
  }),
);
