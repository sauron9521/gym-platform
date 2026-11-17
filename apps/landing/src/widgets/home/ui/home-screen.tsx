import Link from 'next/link';
import { defaultLocale, getMessages, type Locale } from '@gym/i18n';

import { Button } from '@/shared/ui/button';
import {
  CallToAction,
  Container,
  FeatureCard,
  MarketingSection,
  SectionHeading,
} from '@/shared/ui/marketing';

export function HomeScreen({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const t = getMessages(locale).landing.home;
  const audiences = [
    { title: t.audienceAthletesTitle, description: t.audienceAthletesDescription, href: '/for-athletes', action: t.audienceAthletesAction },
    { title: t.audienceTrainersTitle, description: t.audienceTrainersDescription, href: '/for-trainers', action: t.audienceTrainersAction },
    { title: t.audienceAppsTitle, description: t.audienceAppsDescription, href: '/apps', action: t.audienceAppsAction },
  ] as const;
  const milestones = [
    { number: '01', title: t.milestoneOneTitle, detail: t.milestoneOneDetail },
    { number: '02', title: t.milestoneTwoTitle, detail: t.milestoneTwoDetail },
    { number: '03', title: t.milestoneThreeTitle, detail: t.milestoneThreeDetail },
  ] as const;
  return (
    <main id="main-content" className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 -z-10 h-full w-2/3 bg-[radial-gradient(ellipse_at_top_right,oklch(0.87_0.2_125/0.15),transparent_65%)]"
        />
        <Container className="grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold tracking-widest text-primary uppercase">
              Gym Platform · {t.phase}
            </p>
            <h1 className="mt-8 text-5xl font-bold tracking-tight text-balance sm:text-7xl">
              {t.headlineLead} <span className="text-primary">{t.headlineAccent}</span>
            </h1>
            <p className="mt-7 text-lg leading-8 text-muted-foreground">
              {t.description}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/features">{t.learnMore}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/apps">{t.browseApps}</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              {t.devNotice}
            </p>
          </div>
          <div
            role="img"
            aria-label={t.mockAria}
            className="rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-black/20"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-sm font-bold">{t.mockTitle}</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {t.mockBadge}
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[t.mockExercises, t.mockSets, t.mockProgress].map((label, index) => (
                <div key={label} className="rounded-xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-4 text-2xl font-bold text-primary">0{index + 1}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3" aria-hidden="true">
              {[65, 83, 45].map((value) => (
                <div key={value} className="h-3 rounded-full bg-muted">
                  <div className="h-3 rounded-full bg-primary/70" style={{ width: value + '%' }} />
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              {t.mockDisclaimer}
            </p>
          </div>
        </Container>
      </section>

      <MarketingSection aria-labelledby="audiences">
        <Container>
          <SectionHeading
            id="audiences"
            eyebrow={t.audiencesEyebrow}
            title={t.audiencesTitle}
            description={t.audiencesDescription}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map(({ title, description, href, action }) => (
              <FeatureCard
                key={href}
                title={title}
                description={description}
                href={href}
                linkLabel={action}
              />
            ))}
          </div>
        </Container>
      </MarketingSection>

      <MarketingSection tone="subtle" aria-labelledby="workflow">
        <Container>
          <SectionHeading
            id="workflow"
            eyebrow={t.workflowEyebrow}
            title={t.workflowTitle}
            description={t.workflowDescription}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {milestones.map((step) => (
              <div key={step.number} className="rounded-2xl border border-border bg-card p-7">
                <span className="text-sm font-bold text-primary">{step.number}</span>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>

      <CallToAction
        title={t.ctaTitle}
        description={t.ctaDescription}
        primary={{ href: '/apps', label: t.ctaPrimary }}
        secondary={{ href: '/about', label: t.ctaSecondary }}
      />
    </main>
  );
}
