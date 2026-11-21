import { getMessages } from '@gym/i18n';
import type { Metadata } from 'next';

import FeaturesPage from '@/app/features/page';
import { isEnglishPageReady } from '@/i18n/published-pages';
import { requirePublishedLocale } from '@/i18n/route-guard';
import { localizedMetadata } from '@/i18n/seo';

const path = '/features';
const englishReady = isEnglishPageReady(path);

export default async function LocalizedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = requirePublishedLocale(requested, englishReady);
  return <FeaturesPage locale={locale} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = requirePublishedLocale(requested, englishReady);
  const t = getMessages(locale).landing.features;
  return localizedMetadata({
    locale,
    path,
    title: t.metaTitle,
    description: t.metaDescription,
    englishReady,
  });
}
