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
      features={[
        {
          title: 'Мої тренування',
          description: 'Перегляд плану й фіксація підходів у мобільному інтерфейсі.',
        },
        {
          title: 'Програми',
          description: 'Перегляд програм, призначених тренером, і створення тренувань.',
        },
        {
          title: 'Прогрес',
          description: 'Зведена статистика активності та обсягу навантаження.',
        },
        {
          title: 'Захист даних',
          description: 'Перевірка сесій і попередження про відсутність мережі.',
        },
      ]}
      nextLink={{ href: '/for-athletes', label: 'Можливості для спортсменів' }}
    />
  );
}
