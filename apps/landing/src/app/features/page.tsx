import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import {
  CallToAction,
  Container,
  FeatureCard,
  MarketingSection,
  SectionHeading,
} from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Можливості',
  description:
    'Бібліотека вправ, журнал тренувань, тренувальні програми та відстеження прогресу Gym Platform.',
  path: '/features',
});

const capabilities = [
  {
    title: 'Бібліотека вправ',
    description: 'Знаходь вправи та формуй власний набір рухів для тренувань.',
    href: '/for-athletes',
    linkLabel: 'Для спортсменів',
  },
  {
    title: 'Журнал тренувань',
    description: 'Плануй робочі підходи та відстежуй виконану роботу.',
    href: '/for-athletes',
    linkLabel: 'Тренування спортсмена',
  },
  {
    title: 'Програми та версії',
    description: 'Працюй із послідовними тренувальними програмами.',
    href: '/for-trainers',
    linkLabel: 'Для тренерів',
  },
  {
    title: 'Тренер і спортсмен',
    description: 'Організовуй взаємодію навколо тренувального плану.',
    href: '/for-trainers',
    linkLabel: 'Можливості тренера',
  },
] as const;

export default function FeaturesPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">
            Можливості платформи
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Більше контролю над кожним тренуванням
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Gym Platform розвиває інструменти для планування, виконання та аналізу тренувань.
            Частина можливостей ще перебуває в розробці.
          </p>
          <Link
            className="mt-8 inline-flex font-semibold text-primary hover:underline"
            href="/apps"
          >
            Переглянути застосунки
          </Link>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="capabilities">
        <Container>
          <SectionHeading
            id="capabilities"
            eyebrow="Функціонал"
            title="Усе, що допомагає прогресувати"
            description="Окремі інструменти працюють як частини спільної платформи."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {capabilities.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Вибери свій сценарій тренувань"
        description="Дізнайся, як Gym Platform створюється для різних користувачів."
        primary={{ href: '/for-athletes', label: 'Я спортсмен' }}
        secondary={{ href: '/for-trainers', label: 'Я тренер' }}
      />
    </main>
  );
}
