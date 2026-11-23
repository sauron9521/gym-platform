import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Тренерам',
  description:
    'OVRANTO Coach — вебпродукт для персональних тренерів: програми, версії та робота зі спортсменами.',
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
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Тренерам</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-[-0.05em] text-balance sm:text-6xl">
            Більше уваги спортсменам, менше хаосу з програмами
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            OVRANTO Coach — окремий вебпродукт для тренерів: тренувальні програми, їхні версії та
            керована взаємодія зі спортсменами. Публічний запуск ще не оголошено.
          </p>
          <p className="mt-7 inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Статус: у розробці
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
              <div
                key={benefit.title}
                className="rounded-[1.6rem] border border-border bg-card p-7 shadow-sm shadow-foreground/5"
              >
                <div
                  aria-hidden="true"
                  className="mb-7 h-1.5 w-12 rounded-full bg-[var(--brand-terracotta)]"
                />
                <h3 className="text-xl font-bold tracking-tight">{benefit.title}</h3>
                <p className="mt-4 leading-7 text-muted-foreground">{benefit.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title="OVRANTO Coach готується до запуску"
        description="Coach — окремий вебпродукт для тренерів. Зараз доступний лише огляд можливостей, не реєстрація чи вхід."
        primary={{ href: '/apps', label: 'Каталог продуктів' }}
        secondary={{ href: '/features', label: 'Усі можливості' }}
      />
    </main>
  );
}
