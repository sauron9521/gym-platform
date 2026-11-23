import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'OVRANTO Athlete Web',
  description:
    'OVRANTO Athlete Web розвивається для спортсменів: вправи, журнал тренувань, програми й прогрес. Публічний запуск ще не оголошено.',
  path: '/apps/web',
});

const highlights = [
  {
    title: 'Каталог вправ',
    description: 'Глобальні та власні вправи з правилами приватного доступу.',
  },
  {
    title: 'Програми та тренування',
    description: 'Перегляд призначених програм і організація власних тренувань.',
  },
  {
    title: 'Журнал тренувань',
    description: 'Створення тренувань, редагування підходів і перегляд історії.',
  },
  {
    title: 'Профіль',
    description: 'Перегляд і редагування основних даних користувача.',
  },
] as const;

export default function ApplicationPage() {
  return (
    <ApplicationDetail
      eyebrow="OVRANTO Athlete Web"
      title="Тренувальна платформа у браузері"
      description="OVRANTO Athlete Web розвивається для спортсменів: вправи, журнал тренувань, програми й прогрес. Публічний запуск ще не оголошено."
      highlights={highlights}
      audienceLink={{ href: '/for-athletes', label: 'Можливості для спортсменів' }}
      relatedApp={{ href: '/apps/mobile', label: 'Про Mobile' }}
    />
  );
}
