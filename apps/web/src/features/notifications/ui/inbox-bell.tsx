'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useUnreadInbox } from '../model/use-inbox';
import { useInboxSession } from '../model/inbox-session';

export function InboxBell() {
  const t = useTranslations('web.notifications');
  const { count } = useUnreadInbox();
  const session = useInboxSession();
  const pathname = usePathname();
  if (!session.owner || session.failed) return null;
  const label = count === undefined ? t('title') : t('bellLabel', { count });
  return (
    <span className="relative inline-flex shrink-0">
      <Link
        href="/notifications"
        aria-label={label}
        aria-current={pathname === '/notifications' ? 'page' : undefined}
        title={label}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell aria-hidden="true" className="size-5" />
      </Link>
      {count !== undefined && count > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1 min-w-5 rounded-full bg-primary px-1 text-center text-xs font-semibold leading-5 text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  );
}
