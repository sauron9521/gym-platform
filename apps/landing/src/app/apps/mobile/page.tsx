import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'Mobile',
  description:
    'Мобільний Gym Platform розвивається як інструмент для тренувань зі смартфона. Публічне встановлення поки не оголошено.',
  path: '/apps/mobile',
});

const highlights = [
  {
    title: 'Мої тренування',
    description: 'Перегляд занять і робота з підходами в мобільному інтерфейсі.',
  },
  {
    title: 'Програми',
    description: 'Перегляд призначених програм і створення тренувань за планом.',
  },
  {
    title: 'Прогрес',
    description: 'Огляд статистики тренувань та виконаного навантаження.',
  },
  {
    title: 'Робота з мережею',
    description: 'Стани помилок і відсутності з’єднання; повний офлайн-режим ще в розробці.',
  },
] as const;

export default function ApplicationPage() {
  return (
    <ApplicationDetail
      eyebrow="Gym Platform Mobile"
      title="Тренування під рукою"
      description="Мобільний Gym Platform розвивається як інструмент для тренувань зі смартфона. Публічне встановлення поки не оголошено."
      highlights={highlights}
      audienceLink={{ href: '/for-athletes', label: 'Можливості для спортсменів' }}
      relatedApp={{ href: '/apps/web', label: 'Про Web' }}
    />
  );
}
