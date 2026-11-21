import { HomeScreen } from '@/widgets/home/ui/home-screen';
import { requirePublishedLocale } from '@/i18n/route-guard';
export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = requirePublishedLocale(raw, true);
  return <HomeScreen locale={locale} />;
}
