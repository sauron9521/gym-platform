'use client';
import Link from 'next/link';
import { Card } from '@gym/ui-web';
import { useLocale, useTranslations } from 'next-intl';
import { useAdminInbox } from '../model/use-inbox';

const button =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50';
export function AdminInboxScreen() {
  const t = useTranslations('admin.notifications');
  const locale = useLocale();
  const { session, query, mutation, data, unread, read, filter, next, previous, hasPrevious } =
    useAdminInbox();
  const busy = query.isFetching || mutation.isPending;
  return (
    <main id="main-content" className="mx-auto max-w-4xl space-y-6 px-5 py-9 sm:px-8">
      <Link
        prefetch={false}
        href="/"
        className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t('back')}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      {session.blocked ? (
        <Card className="p-5">
          <p role="alert">{t('denied')}</p>
          <a href="/notifications" className={button}>
            {t('reload')}
          </a>
        </Card>
      ) : (
        <Card className="space-y-4 p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{t('unreadExplanation')}</p>
          {session.unavailable || query.isError ? <p role="alert">{t('unavailable')}</p> : null}
          {mutation.isError ? <p role="alert">{t('saveError')}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={button}
              type="button"
              aria-pressed={!unread}
              disabled={!session.canOpen || busy}
              onClick={() => filter(false)}
            >
              {t('all')}
            </button>
            <button
              className={button}
              type="button"
              aria-pressed={unread}
              disabled={!session.canOpen || busy}
              onClick={() => filter(true)}
            >
              {t('unread')}
            </button>
            <button
              className={button}
              type="button"
              disabled={!session.active || busy}
              onClick={() => void session.refresh()}
            >
              {t('refresh')}
            </button>
            <button
              className={button}
              type="button"
              disabled={!data || busy || !session.count}
              onClick={() => void read()}
            >
              {t('markAll')}
            </button>
          </div>
          {session.count !== undefined ? (
            <p aria-live="polite" className="text-sm font-medium">
              {t('bellLabel', { count: session.count })}
            </p>
          ) : null}
          {!data && !session.unavailable && !query.isError ? (
            <p aria-live="polite">{t('loading')}</p>
          ) : null}
          {data?.data.length === 0 ? <p>{t('empty')}</p> : null}
          {data?.data.length ? (
            <ul className="divide-y divide-border">
              {data.data.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="font-semibold">{t('reviewTitle')}</h2>
                    <p className="text-sm text-muted-foreground">{t('reviewDescription')}</p>
                    <p className="text-sm text-muted-foreground">{t('reviewRoutePending')}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={item.createdAt}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'UTC',
                        }).format(new Date(item.createdAt))}{' '}
                        UTC
                      </time>{' '}
                      · {item.readAt ? t('read') : t('unread')}
                    </p>
                  </div>
                  {!item.readAt ? (
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => void read(item.id)}
                    >
                      {t('markRead')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {data && (hasPrevious || data.nextCursor) ? (
            <div className="flex gap-2">
              <button
                className={button}
                type="button"
                disabled={!hasPrevious || busy}
                onClick={previous}
              >
                {t('previous')}
              </button>
              <button
                className={button}
                type="button"
                disabled={!data.nextCursor || busy}
                onClick={next}
              >
                {t('next')}
              </button>
            </div>
          ) : null}
        </Card>
      )}
    </main>
  );
}
