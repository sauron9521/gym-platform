import { pageMetadata } from '@/shared/lib/seo';
import { ApplicationDetail } from '@/widgets/applications/ui/application-detail';

export const metadata = pageMetadata({
  title: 'Web',
  description:
    'Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено.',
  path: '/apps/web',
});

const highlights = [
  {
    title: 'Каталог вправ',
    description: 'Глобальні та власні вправи з правилами приватного доступу.',
  },
  {
    title: 'Тренувальні програми',
    description: 'Чернетки, версії та призначення програм у роботі тренера.',
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
      eyebrow="Gym Platform Web"
      title="Тренувальна платформа у браузері"
      description="Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено."
      highlights={highlights}
      audienceLink={{ href: '/for-trainers', label: 'Можливості для тренерів' }}
      relatedApp={{ href: '/apps/mobile', label: 'Про Mobile' }}
    />
  );
}
