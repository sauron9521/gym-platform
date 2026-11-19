import Link from 'next/link';
import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';

export default async function NotFound() {
  const t = getTrainerCopy((await getLocale()) as Locale);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t.notFound}</h1>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t.returnHome}
      </Link>
    </div>
  );
}
