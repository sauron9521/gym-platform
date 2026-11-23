import Link from 'next/link';

import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

type ApplicationDetailProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: ReadonlyArray<{ title: string; description: string }>;
  audienceLink: {
    href: '/for-athletes' | '/for-trainers';
    label: string;
  };
  relatedApp: {
    href: '/apps/web' | '/apps/mobile';
    label: string;
  };
};

export function ApplicationDetail({
  eyebrow,
  title,
  description,
  highlights,
  audienceLink,
  relatedApp,
}: ApplicationDetailProps) {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-[-0.05em] text-balance sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
          <p className="mt-7 inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Статус: у розробці
          </p>
          <div className="landing-preview-grid mt-10 rounded-[1.6rem] border border-border bg-card/85 p-8 shadow-sm shadow-foreground/5">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Презентація функціоналу
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Реальні скриншоти інтерфейсу додамо після стабілізації відповідних екранів.
            </p>
          </div>
          <Link
            href="/apps"
            className="mt-8 inline-flex rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Продукти OVRANTO
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
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {highlights.map((feature) => (
              <li
                key={feature.title}
                className="rounded-[1.5rem] border border-border bg-card p-7 shadow-sm shadow-foreground/5"
              >
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-7 text-sm leading-6 text-muted-foreground">
            Платформа активно розвивається. Перелік описує напрямки роботи, а не обіцянку
            доступності всіх можливостей у публічному релізі.
          </p>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Що дослідити далі?"
        description="Переглянь можливості для своєї ролі або іншу версію OVRANTO Athlete. Публічний запуск ще не оголошено."
        primary={audienceLink}
        secondary={relatedApp}
      />
    </main>
  );
}
