'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { type InboxFilters, InboxRequestError } from '../api/inbox';
import { inboxDestination, inboxTitleKey } from '../model/inbox-presentation';
import { useInboxList } from '../model/use-inbox';
import { useInboxSession } from '../model/inbox-session';

const categories = ['ALL', 'TRAINER', 'PROGRAM', 'WORKOUT', 'ACCOUNT'] as const;
type Category = (typeof categories)[number];

function InboxContent() {
  const t = useTranslations('web.notifications');
  const format = useFormatter();
  const [category, setCategory] = useState<Category>('ALL');
  const [unread, setUnread] = useState(false);
  const filters: InboxFilters = {
    ...(category === 'ALL' ? {} : { category }),
    ...(unread ? { unread: 'true' } : {}),
  };
  const { session, query, mutation } = useInboxList(filters);
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const items = [...new Map(rows.map((row) => [row.id, row])).values()];
  const error = query.error;
  const denied = error instanceof InboxRequestError && error.status === 403;
  const showData =
    session.active &&
    !query.isError &&
    !query.isPending &&
    (!query.isFetching || query.isFetchingNextPage);
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium" htmlFor="inbox-category">
          {t('category')}
          <select
            id="inbox-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) => setUnread(event.target.checked)}
            className="size-4 accent-primary"
          />
          {t('unreadOnly')}
        </label>
        <Button
          type="button"
          variant="outline"
          className="ml-auto min-h-11"
          disabled={!showData || mutation.isPending}
          onClick={() => mutation.mutate(undefined)}
        >
          {t('readAll')}
        </Button>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('writeError')}
        </p>
      )}
      {mutation.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('saving')}
        </p>
      )}
      {!session.active || query.isPending || (query.isFetching && !query.isFetchingNextPage) ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-card p-6 text-muted-foreground"
        >
          {t('loading')}
        </p>
      ) : query.isError ? (
        <section role="alert" className="space-y-3 rounded-xl border border-border bg-card p-6">
          <p>{t(denied ? 'forbidden' : 'loadError')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </section>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={t('title')}>
          {items.map((item) => {
            const href = inboxDestination(item);
            return (
              <li
                key={item.id}
                className={
                  'rounded-xl border border-border bg-card p-4 sm:p-5 ' +
                  (item.readAt ? '' : 'border-l-4 border-l-primary')
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t(item.category)}</span>
                      {!item.readAt && (
                        <span className="font-semibold text-primary">{t('unread')}</span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold">{t(inboxTitleKey(item))}</h2>
                    <time className="text-sm text-muted-foreground" dateTime={item.createdAt}>
                      {format.dateTime(new Date(item.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  {!item.readAt && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate(item.id)}
                      aria-label={t('readItem', { title: t(inboxTitleKey(item)) })}
                    >
                      {t('markRead')}
                    </Button>
                  )}
                </div>
                {href && (
                  <Link
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={href}
                    aria-label={t('openItem', { title: t(inboxTitleKey(item)) })}
                  >
                    {t('openSection')}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showData && query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? t('loading') : t('loadMore')}
        </Button>
      )}
    </>
  );
}

export function InboxPageScreen() {
  const t = useTranslations('web.notifications');
  const session = useInboxSession();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </header>
      {session.failed ? (
        <section role="alert" className="space-y-3 rounded-xl border border-border bg-card p-6">
          <p>{t('sessionError')}</p>
          <Button variant="outline" onClick={session.retry}>
            {t('retry')}
          </Button>
        </section>
      ) : session.owner ? (
        <InboxContent key={session.owner} />
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </main>
  );
}
