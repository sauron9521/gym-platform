import OriginalPage, { metadata as originalMetadata } from '@/app/apps/mobile/page';
import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/i18n/seo';
import { requirePublishedLocale } from '@/i18n/route-guard';

export default async function LocalizedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  requirePublishedLocale(locale, false);
  return <OriginalPage />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  requirePublishedLocale(locale, false);
  return localizedPageMetadata({
    locale: 'uk',
    path: '/apps/mobile',
    original: originalMetadata,
  });
}
