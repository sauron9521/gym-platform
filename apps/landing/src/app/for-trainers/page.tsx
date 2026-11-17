import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Тренерам',
  description:
    'Інструменти Gym Platform для персональних тренерів: програми, версії та взаємодія зі спортсменами.',
  path: '/for-trainers',
});

const trainerBenefits = [
  {
    title: 'Організація спортсменів',
    detail: 'Структуруй взаємодію та працюй із призначеними тренувальними планами.',
  },
  {
    title: 'Програми та версії',
    detail: 'Створюй тренувальні цикли та поступово змінюй програми.',
  },
  {
    title: 'Спільна історія тренувань',
    detail: 'Дивись на тренувальний процес як на послідовність занять.',
  },
] as const;

export default function TrainersPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">Тренерам</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Більше уваги спортсменам, менше хаосу з програмами
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Gym Platform розвиває інструменти для тренерів: тренувальні програми, їхні версії та
            керовану взаємодію зі спортсменами. Функціонал доповнюється поступово.
          </p>
          <Link
            href="/features"
            className="mt-8 inline-flex rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Можливості платформи
          </Link>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="trainer-benefits">
        <Container>
          <SectionHeading
            id="trainer-benefits"
            eyebrow="Тренерські сценарії"
            title="Структура, яка допомагає вести тренування"
            description="Можливості створюються для послідовної роботи з планами та спортсменами."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {trainerBenefits.map((benefit) => (
              <div key={benefit.title} className="rounded-2xl border border-border bg-card p-7">
                <div aria-hidden="true" className="mb-7 h-1 w-12 rounded-full bg-primary" />
                <h3 className="text-xl font-semibold">{benefit.title}</h3>
                <p className="mt-4 leading-7 text-muted-foreground">{benefit.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Ознайомся з продуктами Gym Platform"
        description="Дізнайся більше про вебзастосунок та мобільну частину платформи."
        primary={{ href: '/apps/web', label: 'Про вебзастосунок' }}
        secondary={{ href: '/apps/mobile', label: 'Про Mobile' }}
      />
    </main>
  );
}
