import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: 'Тренерам',
  description:
    'Gym Platform створює інструменти для організації тренувальних програм і взаємодії тренера зі спортсменами.',
  path: '/for-trainers',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow="Для тренерів"
      title="Тренувальні програми та робота зі спортсменами"
      description="Gym Platform створює інструменти для організації тренувальних програм і взаємодії тренера зі спортсменами."
    />
  );
}
