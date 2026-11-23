import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'OVRANTO Athlete Mobile',
  description:
    'OVRANTO Athlete Mobile розвивається для тренувань зі смартфона. Публічне встановлення поки не оголошено.',
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
      eyebrow="OVRANTO Athlete Mobile"
      title="Тренування під рукою"
      description="OVRANTO Athlete Mobile розвивається для тренувань зі смартфона. Публічне встановлення поки не оголошено."
      highlights={highlights}
      audienceLink={{ href: '/for-athletes', label: 'Можливості для спортсменів' }}
      relatedApp={{ href: '/apps/web', label: 'Про Web' }}
    />
  );
}
