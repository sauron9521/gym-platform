import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import {
  CallToAction,
  Container,
  MarketingSection,
  SectionHeading,
} from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Web',
  description: 'Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено.',
  path: '/apps/web',
});

const highlights = [
  'Керування вправами',
  'Журнал тренувань',
  'Програми тренувань',
] as const;

export default function ApplicationPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">Gym Platform Web</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
            Тренувальна платформа у браузері
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Вебзастосунок Gym Platform розвивається для роботи з вправами, журналом тренувань та програмами. Публічний запуск ще не оголошено.
          </p>
          <p className="mt-7 inline-flex rounded-full border border-primary/30 px-4 py-2 text-sm text-primary">
            Статус: у розробці
          </p>
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Презентація функціоналу
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Реальні скриншоти інтерфейсу додамо після стабілізації відповідних екранів.
            </p>
          </div>
          <Link href="/apps" className="mt-8 inline-flex font-semibold text-primary hover:underline">
            Усі застосунки
          </Link>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="app-highlights">
        <Container>
          <SectionHeading
            id="app-highlights"
            eyebrow="Що розвиваємо"
            title="Ключові можливості"
            description="Сценарії, навколо яких розвивається застосунок."
          />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {highlights.map((feature) => (
              <li key={feature} className="rounded-xl border border-border bg-card p-6">
                <span aria-hidden="true" className="text-primary">✓ </span>
                {feature}
              </li>
            ))}
          </ul>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Ознайомся з іншим застосунком"
        description="Відкрий повну екосистему Gym Platform."
        primary={{ href: '/apps/mobile', label: 'Про Mobile' }}
      />
    </main>
  );
}
