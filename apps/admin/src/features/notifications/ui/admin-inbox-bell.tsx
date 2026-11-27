'use client';
import { useTranslations } from 'next-intl';
import { AdminInboxProvider, useInboxSession } from '../model/inbox-session';

export function InboxBell() {
  const t = useTranslations('admin.notifications');
  const { canOpen, count, blocked } = useInboxSession();
  if (!canOpen || blocked) return null;
  return (
    <span className="relative inline-flex shrink-0">
      <a
        href="/notifications"
        aria-label={count === undefined ? t('title') : t('bellLabel', { count })}
        className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      </a>
      {count !== undefined && count > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1 min-w-5 rounded-full border border-border bg-card px-1 text-center text-xs font-semibold leading-5 text-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </span>
  );
}
export function AdminNotificationBell({ owner }: { owner: string }) {
  return (
    <AdminInboxProvider owner={owner}>
      <InboxBell />
    </AdminInboxProvider>
  );
}
