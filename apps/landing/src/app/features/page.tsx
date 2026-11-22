import { defaultLocale, getMessages, type Locale } from '@gym/i18n';
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

export default function FeaturesPage({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const t = getMessages(locale).landing.features;
  const capabilities = [
    {
      title: t.libraryTitle,
      description: t.libraryDescription,
      href: '/for-athletes',
      linkLabel: t.libraryAction,
    },
    {
      title: t.journalTitle,
      description: t.journalDescription,
      href: '/for-athletes',
      linkLabel: t.journalAction,
    },
    {
      title: t.programsTitle,
      description: t.programsDescription,
      href: '/for-trainers',
      linkLabel: t.programsAction,
    },
    {
      title: t.coachingTitle,
      description: t.coachingDescription,
      href: '/for-trainers',
      linkLabel: t.coachingAction,
    },
  ] as const;

  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">{t.eyebrow}</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-[-0.05em] text-balance sm:text-6xl">
            {t.heading}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{t.description}</p>
          <Link
            className="mt-8 inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href="/apps"
          >
            {t.browseApps}
          </Link>
        </Container>
      </MarketingSection>
      <MarketingSection tone="subtle" aria-labelledby="capabilities">
        <Container>
          <SectionHeading
            id="capabilities"
            eyebrow={t.capabilitiesEyebrow}
            title={t.capabilitiesTitle}
            description={t.capabilitiesDescription}
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {capabilities.map((item) => (
              <FeatureCard key={item.href + item.title} {...item} />
            ))}
          </div>
        </Container>
      </MarketingSection>
      <CallToAction
        title={t.ctaTitle}
        description={t.ctaDescription}
        primary={{ href: '/for-athletes', label: t.ctaAthlete }}
        secondary={{ href: '/for-trainers', label: t.ctaTrainer }}
      />
    </main>
  );
}
