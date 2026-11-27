import { useState, useRef } from 'react';
import { useIntl } from 'react-intl';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '@/shared/config/theme-provider';
import { AsyncResourceState } from '@/shared/ui/async-resource-state';
import { useInboxList } from '../model/inbox-query';
import { useInboxOpen } from '../model/use-inbox-open';
import { inboxTitleKey } from '../model/inbox-presentation';
import { canOpenProgram, type InboxFilters } from '../services/inbox-api';

const categories = ['ALL', 'TRAINER', 'PROGRAM', 'WORKOUT', 'ACCOUNT'] as const;
type Category = (typeof categories)[number];

export function InboxScreen() {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: 'mobile.notifications.' + key }, values);
  const [category, setCategory] = useState<Category>('ALL');
  const [unread, setUnread] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [opening, setOpening] = useState(false);
  const openLock = useRef(false);
  const filters: InboxFilters = {
    ...(category === 'ALL' ? {} : { category }),
    ...(unread ? { unread: 'true' } : {}),
  };
  const { scope, query, mutation } = useInboxList(filters);
  const coordinator = useInboxOpen(scope);
  const ready =
    !!scope &&
    scope.isCurrent() &&
    query.isSuccess &&
    (!query.isFetching || query.isFetchingNextPage);
  const items = ready
    ? [
        ...new Map(
          query.data.pages.flatMap((page) => page.data).map((item) => [item.id, item]),
        ).values(),
      ]
    : [];
  const disabled = !ready || mutation.isPending || opening;
  const open = async (notificationId: string) => {
    if (openLock.current || disabled) return;
    openLock.current = true;
    setOpening(true);
    setOpenError(false);
    try {
      const result = await coordinator.open({ notificationId });
      if (result !== 'opened' && result !== 'stale') setOpenError(true);
    } finally {
      openLock.current = false;
      setOpening(false);
    }
  };
  const button = (
    label: string,
    onPress: () => void,
    off = false,
    testID?: string,
    accessibleLabel = label,
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={[styles.button, off && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching}
      onRefresh={() => {
        if (scope && !query.isFetching) void query.refetch();
      }}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('title')}
          </Text>
          <Text style={styles.muted}>{t('description')}</Text>
          <Text style={styles.heading}>{t('category')}</Text>
          <View style={styles.filters}>
            {categories.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: category === value }}
                onPress={() => setCategory(value)}
                style={[styles.button, category === value && styles.selected]}
              >
                <Text style={styles.buttonText}>{t(value)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: unread }}
            onPress={() => setUnread((value) => !value)}
            style={[styles.button, unread && styles.selected]}
          >
            <Text style={styles.buttonText}>{t('unreadOnly')}</Text>
          </Pressable>
          {button(
            t('readAll'),
            () => mutation.mutate(undefined),
            disabled,
            'mobile-inbox-read-all',
          )}
          {mutation.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t('writeError')}
            </Text>
          ) : null}
          {mutation.isPending ? <Text style={styles.muted}>{t('saving')}</Text> : null}
          {openError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t('openError')}
            </Text>
          ) : null}
          {query.isError ? (
            <AsyncResourceState
              kind="error"
              message={t('loadError')}
              retryLabel={t('retry')}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : !ready ? (
            <AsyncResourceState kind="loading" message={t('loading')} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        ready ? <AsyncResourceState kind="empty" message={t('empty')} /> : undefined
      }
      renderItem={({ item }) => (
        <View style={[styles.card, !item.readAt && styles.unread]}>
          <Text style={styles.muted}>
            {t(item.category)}
            {!item.readAt ? ' · ' + t('unread') : ''}
          </Text>
          <Text accessibilityRole="header" style={styles.heading}>
            {t(inboxTitleKey(item))}
          </Text>
          <Text style={styles.muted}>
            {intl.formatDate(new Date(item.createdAt), { dateStyle: 'medium' })} ·{' '}
            {intl.formatTime(new Date(item.createdAt), { timeStyle: 'short' })}
          </Text>
          {!item.readAt
            ? button(
                t('markRead'),
                () => mutation.mutate(item.id),
                disabled,
                'mobile-inbox-read-' + item.id,
                t('readItem', { title: t(inboxTitleKey(item)) }),
              )
            : null}
          {canOpenProgram(item)
            ? button(
                t('openSection'),
                () => void open(item.id),
                disabled,
                'mobile-inbox-open-' + item.id,
                t('openItem', { title: t(inboxTitleKey(item)) }),
              )
            : null}
        </View>
      )}
      ListFooterComponent={
        ready && query.hasNextPage
          ? button(
              query.isFetchingNextPage ? t('loading') : t('loadMore'),
              () => void query.fetchNextPage(),
              query.isFetching,
              'mobile-inbox-load-more',
            )
          : undefined
      }
    />
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { padding: 20, gap: 12 },
    section: { gap: 12 },
    title: { fontSize: 26, fontWeight: '700', color: palette.text },
    heading: { fontSize: 16, fontWeight: '600', color: palette.text },
    muted: { color: palette.muted, fontSize: 14 },
    error: { color: palette.error, fontSize: 14 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: {
      padding: 16,
      gap: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 14,
    },
    unread: { borderLeftWidth: 4, borderLeftColor: palette.primary },
    button: {
      minHeight: 44,
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
    },
    selected: { borderColor: palette.primary, borderWidth: 2 },
    buttonText: { color: palette.text, fontWeight: '600' },
    disabled: { opacity: 0.5 },
  }),
);
