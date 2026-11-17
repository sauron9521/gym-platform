import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTrainerAthletes } from '@/features/trainer-athletes/model/trainer-athletes-query';
import { palette } from '@/shared/config/theme';

export function TrainerAthletesScreen() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const query = useTrainerAthletes();
  const athletes = useMemo(() => {
    const seen = new Set<string>();
    return (
      query.data?.pages.flatMap((page) =>
        page.data.filter((relation) => {
          if (seen.has(relation.id)) return false;
          seen.add(relation.id);
          return true;
        }),
      ) ?? []
    );
  }, [query.data]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={athletes}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.45}
      ListHeaderComponent={
        <View style={styles.group}>
          <Text style={styles.title}>{t('mobile.trainerAthletes.title')}</Text>
          <Text style={styles.muted}>{t('mobile.trainerAthletes.subtitle')}</Text>
          {query.isPending ? (
            <Text style={styles.muted}>{t('mobile.trainerAthletes.loading')}</Text>
          ) : null}
          {query.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {query.error.message}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !query.isPending && !query.isError ? (
          <Text style={styles.muted}>{t('mobile.trainerAthletes.empty')}</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.titleSmall}>
            {t('mobile.trainerAthletes.athlete')} · {item.athlete.id.slice(0, 8)}
          </Text>
        </View>
      )}
      ListFooterComponent={
        query.hasNextPage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              query.isFetchNextPageError
                ? 'mobile.trainerAthletes.retryLoadMore'
                : 'mobile.trainerAthletes.loadMore',
            )}
            testID="trainer-athletes-load-more"
            disabled={query.isFetching}
            style={styles.button}
            onPress={() => void query.fetchNextPage()}
          >
            <Text style={styles.buttonText}>
              {t(
                query.isFetchingNextPage
                  ? 'mobile.trainerAthletes.loadingMore'
                  : query.isFetchNextPageError
                    ? 'mobile.trainerAthletes.retryLoadMore'
                    : 'mobile.trainerAthletes.loadMore',
              )}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.background, flex: 1 },
  content: { gap: 12, padding: 24 },
  group: { gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: palette.text },
  titleSmall: { fontSize: 16, fontWeight: '600', color: palette.text },
  muted: { color: palette.muted },
  error: { color: '#ff6460' },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    gap: 8,
  },
  button: {
    padding: 14,
    minHeight: 44,
    backgroundColor: palette.primary,
    borderRadius: 12,
    justifyContent: 'center',
  },
  buttonText: { color: palette.background, textAlign: 'center', fontWeight: '700' },
});
