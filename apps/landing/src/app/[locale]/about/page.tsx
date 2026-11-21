import OriginalPage from '@/app/about/page';
import { requirePublishedLocale } from '@/i18n/route-guard';

export default async function LocalizedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  requirePublishedLocale(locale, false);
  return <OriginalPage />;
}
