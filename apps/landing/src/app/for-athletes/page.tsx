import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import {
  CallToAction,
  Container,
  MarketingSection,
  SectionHeading,
} from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Спортсменам',
  description:
    'Знайомтеся з Gym Platform для спортсменів: бібліотека вправ, журнал тренувань, програми й прогрес.',
  path: '/for-athletes',
});

const steps = [
  { number: '01', title: 'Підбери вправи', text: 'Створюй особистий набір вправ.' },
  { number: '02', title: 'Сплануй заняття', text: 'Збирай тренування та підходи в одному місці.' },
  { number: '03', title: 'Фіксуй результат', text: 'Спостерігай за змінами від заняття до заняття.' },
] as const;

export default function AthletesPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">Спортсменам</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Твоє тренування — під твоїм контролем
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Gym Platform допомагає організовувати тренувальний процес і зосередитися на
            поступовому прогресі. Доступність функцій залежить від етапу розробки.
          </p>
          <Link
            href="/features"
            className="mt-8 inline-flex font-semibold text-primary underline-offset-4 hover:underline"
          >
            Переглянути можливості
          </Link>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="athlete-journey">
        <Container>
          <SectionHeading
            id="athlete-journey"
            eyebrow="Для твого прогресу"
            title="Від ідеї до тренувального плану"
            description="Простий послідовний процес замість розрізнених записів."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-border bg-card p-7">
                <span className="text-sm font-bold text-primary">{step.number}</span>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Дізнайся більше про застосунки"
        description="Ознайомся з Web і Mobile, що розвиваються як частини Gym Platform."
        primary={{ href: '/apps', label: 'Застосунки платформи' }}
      />
    </main>
  );
}
