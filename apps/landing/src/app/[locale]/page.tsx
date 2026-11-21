import { HomeScreen } from '@/widgets/home/ui/home-screen';
import { getMessages } from '@gym/i18n';
import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/seo';
import { requirePublishedLocale } from '@/i18n/route-guard';
export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = requirePublishedLocale(raw, true);
  return <HomeScreen locale={locale} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = requirePublishedLocale(raw, true);
  const title =
    locale === 'en' ? 'Gym Platform — Train smarter' : 'Gym Platform — тренування та прогрес';
  const description = getMessages(locale).landing.home.description;
  return localizedMetadata({ locale, title, description, englishReady: true });
}
