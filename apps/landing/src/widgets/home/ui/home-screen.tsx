import Link from 'next/link';
import { defaultLocale, getMessages, type Locale } from '@gym/i18n';

import { Button } from '@/shared/ui/button';
import { CallToAction, Container, MarketingSection, SectionHeading } from '@/shared/ui/marketing';
import { ProductDiscovery } from './product-discovery';

export function HomeScreen({ locale = defaultLocale }: { locale?: Locale } = {}) {
  const t = getMessages(locale).landing.home;
  const milestones = [
    { number: '01', title: t.milestoneOneTitle, detail: t.milestoneOneDetail },
    { number: '02', title: t.milestoneTwoTitle, detail: t.milestoneTwoDetail },
    { number: '03', title: t.milestoneThreeTitle, detail: t.milestoneThreeDetail },
  ] as const;
  return (
    <main id="main-content" className="flex-1">
      <section className="landing-hero-surface relative isolate overflow-hidden border-b border-border/70">
        <Container className="relative grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-16 lg:py-36">
          <div className="landing-hero-copy relative z-10 min-w-0">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.13em] text-primary uppercase">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[var(--brand-terracotta)]"
              />
              OVRANTO · {t.phase}
            </p>
            <h1 className="mt-8 max-w-2xl text-[clamp(2.8rem,5.5vw,5.2rem)] leading-[1.08] font-extrabold tracking-[-0.055em] text-balance">
              {t.headlineLead} <span className="text-primary">{t.headlineAccent}</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              {t.description}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="touch" className="rounded-xl px-6 font-bold">
                <Link href="/for-athletes">{t.heroAthleteAction}</Link>
              </Button>
              <Button
                asChild
                size="touch"
                variant="outline"
                className="rounded-xl border-border bg-card px-6 font-bold shadow-sm"
              >
                <Link href="/for-trainers">{t.heroTrainerAction}</Link>
              </Button>
            </div>
            <p className="mt-7 max-w-md border-l-[3px] border-[var(--brand-terracotta)] pl-4 text-sm leading-6 text-muted-foreground">
              {t.devNotice}
            </p>
          </div>

          <div className="landing-hero-visual relative min-w-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-9 -right-8 h-36 w-36 rounded-full border-[18px] border-[var(--brand-terracotta)]/20 sm:h-52 sm:w-52"
            />
            <div
              role="img"
              aria-label={t.mockAria}
              className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl shadow-foreground/10 ring-1 ring-primary/10"
            >
              <div className="flex items-center justify-between gap-4 bg-primary px-5 py-5 text-primary-foreground sm:px-7">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex shrink-0 gap-1.5">
                    <span className="size-2 rounded-full bg-primary-foreground/55" />
                    <span className="size-2 rounded-full bg-primary-foreground/35" />
                    <span className="size-2 rounded-full bg-[var(--brand-terracotta)]" />
                  </span>
                  <span className="truncate text-sm font-bold tracking-tight">{t.mockTitle}</span>
                </div>
                <span className="shrink-0 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                  {t.mockBadge}
                </span>
              </div>
              <div className="landing-preview-grid p-5 sm:p-7">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div
                    aria-hidden="true"
                    className="mb-5 h-1.5 w-10 rounded-full bg-[var(--brand-terracotta)]"
                  />
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[t.mockExercises, t.mockSets, t.mockProgress].map((label, index) => (
                      <div key={label} className="min-w-0 rounded-xl bg-secondary/80 px-3 py-4">
                        <p className="text-[11px] leading-4 font-medium text-muted-foreground sm:text-xs">
                          {label}
                        </p>
                        <p className="mt-4 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                          0{index + 1}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 space-y-4" aria-hidden="true">
                    {[65, 83, 45].map((value, index) => (
                      <div key={value} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                          0{index + 1}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: value + '%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">{t.mockDisclaimer}</p>
              </div>
            </div>
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
          <ProductDiscovery locale={locale} />
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
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {milestones.map((step) => (
              <div
                key={step.number}
                className="landing-milestone-card relative overflow-hidden rounded-[1.6rem] border border-border bg-card p-7 shadow-sm shadow-foreground/5"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 h-1.5 w-20 rounded-br-full bg-[var(--brand-terracotta)]"
                />
                <span className="text-sm font-extrabold tracking-widest text-primary">
                  {step.number}
                </span>
                <h3 className="mt-6 text-xl font-bold tracking-tight">{step.title}</h3>
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
