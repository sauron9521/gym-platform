import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: 'Mobile',
  description:
    'Мобільний застосунок Gym Platform створюється для доступу до тренувань і результатів зі смартфона.',
  path: '/apps/mobile',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow="Мобільний застосунок"
      title="Тренування зі смартфона"
      description="Мобільний застосунок Gym Platform створюється для доступу до тренувань і результатів зі смартфона."
    />
  );
}
