'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getTrainerCopy(useLocale() as Locale);

  useEffect(() => {
    // Never log private payloads or session tokens from error objects.
    void error.digest;
  }, [error]);

  return (
    <div role="alert" className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-7">
      <h1 className="text-xl font-semibold">{t.unavailable}</h1>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t.retry}
      </button>
    </div>
  );
}
