import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: 'Застосунки',
  description:
    'Знайомтеся з вебзастосунком і мобільним застосунком Gym Platform. Обидва продукти наразі розвиваються.',
  path: '/apps',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow="Застосунки Gym Platform"
      title="Один продукт. Різні способи тренуватися."
      description="Знайомтеся з вебзастосунком і мобільним застосунком Gym Platform. Обидва продукти наразі розвиваються."
      features={[
        {
          title: 'Web',
          description: 'Тренувальні програми, каталог вправ і робота тренера зі спортсменами.',
        },
        {
          title: 'Mobile',
          description: 'Журнал тренувань, програми та перегляд персонального прогресу.',
        },
      ]}
      nextLink={{ href: '/features', label: 'Переглянути функції платформи' }}
    />
  );
}
