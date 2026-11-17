import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: 'Web',
  description:
    'Вебзастосунок Gym Platform розробляється для керування тренуваннями, вправами та тренувальними програмами.',
  path: '/apps/web',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow="Вебзастосунок"
      title="Gym Platform у браузері"
      description="Вебзастосунок Gym Platform розробляється для керування тренуваннями, вправами та тренувальними програмами."
      features={[
        {
          title: 'Каталог вправ',
          description: 'Перегляд і керування доступними вправами з урахуванням приватності.',
        },
        {
          title: 'Програми тренувань',
          description: 'Робота тренера з чернетками, версіями й призначеннями програм.',
        },
        {
          title: 'Тренування',
          description: 'Планування та запис виконаних підходів із перевірками станів.',
        },
        {
          title: 'Профіль',
          description: 'Редагування персональних даних у захищеному кабінеті.',
        },
      ]}
      nextLink={{ href: '/for-trainers', label: 'Інструменти для тренерів' }}
    />
  );
}
