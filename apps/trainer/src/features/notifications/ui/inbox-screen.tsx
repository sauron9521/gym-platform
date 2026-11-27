'use client';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Button, Card } from '@gym/ui-web';
import { useTrainerInbox } from '../model/inbox-query';
import { sessionKey, useTrainerInboxSession } from '../model/inbox-session';
import { canOpenClient, resolveClient, type InboxItem, type InboxFilters } from '../api/inbox';

const titles: Record<string, string> = {
  'account.security.changed': 'securityChanged',
  'trainer.invitation.created': 'invitationCreated',
  'trainer.invitation.accepted': 'invitationAccepted',
  'trainer.invitation.declined': 'invitationDeclined',
  'trainer.invitation.cancelled': 'invitationCancelled',
  'trainer.relationship.terminated': 'relationshipTerminated',
  'program.assigned': 'programAssigned',
  'program.assignment.cancelled': 'programCancelled',
  'program.assignment.terminated': 'programTerminated',
  'program.assignment.completed': 'programCompleted',
  'trainer.application.reviewed': 'applicationReviewed',
  'trainer.application.revoked': 'applicationRevoked',
};
function titleKey(item: InboxItem) {
  return item.type === item.templateKey && Object.hasOwn(titles, item.type)
    ? titles[item.type]!
    : 'generic';
}
const categories = ['ALL', 'ACCOUNT', 'TRAINER', 'PROGRAM', 'WORKOUT'] as const;
type Category = (typeof categories)[number];

function InboxContent() {
  const t = useTranslations('web.notifications');
  const local = useTranslations('trainer.notifications');
  const format = useFormatter();
  const router = useRouter();
  const client = useQueryClient();
  const [category, setCategory] = useState<Category>('ALL');
  const [unread, setUnread] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  const attempt = useRef<AbortController | null>(null);
  const filters: InboxFilters = {
    ...(category !== 'ALL' ? { category } : {}),
    ...(unread ? { unread: 'true' } : {}),
  };
  const { query, mutation, session } = useTrainerInbox(filters);
  const ready =
    session.active && query.isSuccess && (!query.isFetching || query.isFetchingNextPage);
  const items = ready
    ? [...new Map(query.data.pages.flatMap((p) => p.data).map((item) => [item.id, item])).values()]
    : [];
  useEffect(() => {
    const cancel = () => {
      if (document.visibilityState !== 'visible') attempt.current?.abort();
    };
    document.addEventListener('visibilitychange', cancel);
    return () => {
      attempt.current?.abort();
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [session.owner, session.active]);
  async function open(item: InboxItem) {
    if (
      !session.owner ||
      !session.active ||
      attempt.current ||
      document.visibilityState !== 'visible'
    )
      return;
    const controller = new AbortController();
    attempt.current = controller;
    setOpening(true);
    setOpenError(false);
    try {
      const href = await resolveClient(session.owner, item.id, controller.signal);
      if (
        !controller.signal.aborted &&
        document.visibilityState === 'visible' &&
        client.getQueryData(sessionKey) === session.owner
      )
        router.push(href);
    } catch (error) {
      if (!controller.signal.aborted) {
        session.handleError(error);
        setOpenError(true);
      }
    } finally {
      attempt.current = null;
      setOpening(false);
    }
  }
  const busy = mutation.isPending || opening;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('category')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
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
            onChange={(e) => setUnread(e.target.checked)}
            className="size-4 accent-primary"
          />
          {t('unreadOnly')}
        </label>
        <Button
          variant="outline"
          size="touch"
          className="ml-auto"
          disabled={!ready || busy}
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
      {openError && (
        <p role="alert" className="text-sm text-destructive">
          {local('openError')}
        </p>
      )}
      {mutation.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('saving')}
        </p>
      )}
      {query.isError ? (
        <Card className="p-5 space-y-3">
          <p role="alert">{t('loadError')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </Card>
      ) : !ready ? (
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      ) : items.length === 0 ? (
        <Card className="p-5 text-muted-foreground">{t('empty')}</Card>
      ) : (
        <ul className="space-y-3" aria-label={t('title')}>
          {items.map((item) => (
            <li
              key={item.id}
              className={
                'rounded-xl border border-border bg-card p-4 ' +
                (!item.readAt ? 'border-l-4 border-l-primary' : '')
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t(item.category)}
                    {!item.readAt && (
                      <span className="ml-2 font-semibold text-primary">{t('unread')}</span>
                    )}
                  </p>
                  <h2 className="font-semibold">{t(titleKey(item))}</h2>
                  <time className="text-sm text-muted-foreground" dateTime={item.createdAt}>
                    {format.dateTime(new Date(item.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                {!item.readAt && (
                  <Button
                    size="touch"
                    variant="outline"
                    disabled={busy}
                    aria-label={t('readItem', { title: t(titleKey(item)) })}
                    onClick={() => mutation.mutate(item.id)}
                  >
                    {t('markRead')}
                  </Button>
                )}
              </div>
              {canOpenClient(item) && (
                <Button
                  variant="link"
                  size="touch"
                  disabled={busy}
                  className="mt-2 px-0"
                  onClick={() => void open(item)}
                >
                  {local('openClient')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ready && query.hasNextPage && (
        <Button
          variant="outline"
          size="touch"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? t('loading') : t('loadMore')}
        </Button>
      )}
    </div>
  );
}
export function TrainerInboxScreen() {
  const t = useTranslations('web.notifications');
  const local = useTranslations('trainer.notifications');
  const session = useTrainerInboxSession();
  return (
    <section className="space-y-6" aria-labelledby="trainer-inbox-title">
      <header className="space-y-2">
        <h1 id="trainer-inbox-title" className="text-3xl font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{local('description')}</p>
      </header>
      {session.failed ? (
        <Card className="p-5 space-y-3">
          <p role="alert">{t('sessionError')}</p>
          <Button variant="outline" onClick={session.retry}>
            {t('retry')}
          </Button>
        </Card>
      ) : session.owner ? (
        <InboxContent key={session.owner} />
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </section>
  );
}
