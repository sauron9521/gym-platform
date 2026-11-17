import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'Web',
  description:
    'Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено.',
  path: '/apps/web',
});

const highlights = ['Керування вправами', 'Журнал тренувань', 'Програми тренувань'] as const;

export default function ApplicationPage() {
  return (
    <ApplicationDetail
      eyebrow="Gym Platform Web"
      title="Тренувальна платформа у браузері"
      description="Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено."
      highlights={highlights}
      relatedApp={{ href: '/apps/mobile', label: 'Про Mobile' }}
    />
  );
}
