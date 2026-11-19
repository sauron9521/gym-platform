import { getLocale } from 'next-intl/server';

import type { Locale } from '@gym/i18n';

import { getTrainerCopy } from '@/shared/i18n/copy';

export default async function HomePage() {
  const locale = (await getLocale()) as Locale;
  const t = getTrainerCopy(locale);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm font-bold tracking-[0.1em] text-primary uppercase">{t.pageEyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t.pageTitle}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">{t.pageDescription}</p>
      </div>
      <section
        aria-label={t.status}
        className="max-w-3xl rounded-2xl border border-border bg-card p-7"
      >
        <h2 className="text-xl font-semibold">{t.status}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.statusDescription}</p>
      </section>
    </div>
  );
}
