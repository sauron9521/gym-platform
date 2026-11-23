import Link from 'next/link';

import { pageMetadata } from '@/shared/lib/seo';
import { Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

export const metadata = pageMetadata({
  title: 'Продукти OVRANTO',
  description:
    'OVRANTO Athlete для спортсменів у Web і Mobile та OVRANTO Coach для тренерів. Інформація про продукти й етапи їхнього розвитку.',
  path: '/apps',
});

const applications = [
  {
    title: 'OVRANTO Athlete Web',
    audience: 'Для спортсменів · браузер',
    description: 'Бібліотека вправ, журнал тренувань і прогрес у вебінтерфейсі спортсмена.',
    status: 'У розробці',
    href: '/apps/web',
    action: 'Про Athlete Web',
  },
  {
    title: 'OVRANTO Athlete Mobile',
    audience: 'Для спортсменів · смартфон',
    description: 'Тренування, підходи та історія занять у мобільному інтерфейсі.',
    status: 'У розробці',
    href: '/apps/mobile',
    action: 'Про Athlete Mobile',
  },
  {
    title: 'OVRANTO Coach Web',
    audience: 'Для тренерів · браузер',
    description:
      'Окремий вебпродукт для керування тренувальними програмами й роботою зі спортсменами.',
    status: 'У розробці',
    href: '/for-trainers',
    action: 'Про OVRANTO Coach',
  },
] as const;

export default function ApplicationsPage() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection aria-labelledby="app-title">
        <Container>
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
            Продукти OVRANTO
          </p>
          <h1
            id="app-title"
            className="mt-6 max-w-4xl text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl"
          >
            Athlete і Coach — для різних ролей
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            OVRANTO Athlete розвивається для спортсменів у Web і Mobile, а OVRANTO Coach — окремий
            вебпродукт для тренерів. Публічні посилання з’являться лише після запуску.
          </p>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {applications.map((app) => (
              <article
                key={app.href}
                className="rounded-[1.6rem] border border-border bg-card p-8 shadow-sm shadow-foreground/5"
              >
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {app.status}
                </p>
                <h2 className="mt-6 text-2xl font-extrabold tracking-tight">{app.title}</h2>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">{app.audience}</p>
                <p className="mt-4 leading-7 text-muted-foreground">{app.description}</p>
                <Link
                  href={app.href}
                  className="mt-8 inline-flex rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  {app.action}
                </Link>
              </article>
            ))}
          </div>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="apps-goals">
        <Container>
          <SectionHeading
            id="apps-goals"
            eyebrow="Екосистема"
            title="Тренування для спортсмена й тренера"
            description="OVRANTO поєднує продукти для різних ролей навколо тренувального процесу."
          />
        </Container>
      </MarketingSection>
    </main>
  );
}
