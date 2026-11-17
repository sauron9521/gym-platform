import Link from 'next/link';

import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

type ApplicationDetailProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: readonly string[];
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
  relatedApp,
}: ApplicationDetailProps) {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
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
          <Link
            href="/apps"
            className="mt-8 inline-flex rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
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
                <span aria-hidden="true" className="text-primary">
                  ✓{' '}
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </Container>
      </MarketingSection>
      <CallToAction
        title="Ознайомся з іншим застосунком"
        description="Відкрий повну екосистему Gym Platform."
        primary={relatedApp}
      />
    </main>
  );
}
