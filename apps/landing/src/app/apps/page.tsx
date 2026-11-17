import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import { Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Застосунки',
  description:
    'Знайомтеся з вебзастосунком та мобільною частиною екосистеми Gym Platform.',
  path: '/apps',
});

const applications = [
  {
    title: 'Gym Platform Web',
    description: 'Тренувальні програми, вправи та історія тренувань у браузері.',
    status: 'У розробці',
    href: '/apps/web',
    action: 'Дізнатися про Web',
  },
  {
    title: 'Gym Platform Mobile',
    description: 'Інструменти тренувань на смартфоні, що поступово доповнюються.',
    status: 'У розробці',
    href: '/apps/mobile',
    action: 'Дізнатися про Mobile',
  },
] as const;

export default function ApplicationsPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection aria-labelledby="app-title">
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">
            Застосунки Gym Platform
          </p>
          <h1 id="app-title" className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
            Одне тренувальне середовище — Web і Mobile
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Обирай спосіб взаємодії з платформою. Веб- і мобільний застосунки розвиваються
            паралельно; публічні посилання на запуск з’являться після релізу.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {applications.map((app) => (
              <div key={app.href} className="rounded-2xl border border-border bg-card p-8">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {app.status}
                </p>
                <h2 className="mt-6 text-2xl font-bold">{app.title}</h2>
                <p className="mt-4 leading-7 text-muted-foreground">{app.description}</p>
                <Link
                  href={app.href}
                  className="mt-8 inline-flex font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {app.action}
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="apps-goals">
        <Container>
          <SectionHeading
            id="apps-goals"
            eyebrow="Екосистема"
            title="Тренуйся на власних умовах"
            description="Gym Platform поєднує різні інтерфейси навколо одного тренувального процесу."
          />
        </Container>
      </MarketingSection>
    </main>
  );
}
