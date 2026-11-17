import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'Mobile',
  description:
    'Мобільний Gym Platform розвивається як інструмент для тренувань зі смартфона. Публічне встановлення поки не оголошено.',
  path: '/apps/mobile',
});

const highlights = ['Плани зі смартфона', 'Журнал вправ', 'Робота над прогресом'] as const;

export default function ApplicationPage() {
  return (
    <ApplicationDetail
      eyebrow="Gym Platform Mobile"
      title="Тренування під рукою"
      description="Мобільний Gym Platform розвивається як інструмент для тренувань зі смартфона. Публічне встановлення поки не оголошено."
      highlights={highlights}
      relatedApp={{ href: '/apps/web', label: 'Про Web' }}
    />
  );
}
