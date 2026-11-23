import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Спортсменам',
  description:
    'OVRANTO Athlete для спортсменів: бібліотека вправ, журнал тренувань, програми та прогрес. Athlete Web і Mobile ще в розробці.',
  path: '/for-athletes',
});

const steps = [
  { number: '01', title: 'Підбери вправи', text: 'Створюй особистий набір вправ.' },
  { number: '02', title: 'Сплануй заняття', text: 'Збирай тренування та підходи в одному місці.' },
  {
    number: '03',
    title: 'Фіксуй результат',
    text: 'Спостерігай за змінами від заняття до заняття.',
  },
] as const;

export default function AthletesPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Спортсменам</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-[-0.05em] text-balance sm:text-6xl">
            Твоє тренування — під твоїм контролем
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            OVRANTO Athlete розвивається для організації вправ, тренувань і прогресу у Web та
            Mobile. Публічний запуск цих продуктів ще не оголошено.
          </p>
          <p className="mt-7 inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Статус: у розробці
          </p>
          <div className="mt-6">
            <Link
              href="/features"
              className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              Переглянути можливості
            </Link>
          </div>
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
              <div
                key={step.number}
                className="rounded-[1.6rem] border border-border bg-card p-7 shadow-sm shadow-foreground/5"
              >
                <span className="text-sm font-bold text-primary">{step.number}</span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Обери, як знайомитися з OVRANTO Athlete"
        description="Athlete Web і Athlete Mobile перебувають у розробці. Дізнайся про кожну версію без переходу до неоголошеного запуску."
        primary={{ href: '/apps/web', label: 'Про Athlete Web' }}
        secondary={{ href: '/apps/mobile', label: 'Про Athlete Mobile' }}
      />
    </main>
  );
}
