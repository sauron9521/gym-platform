import { getMessages, type Locale } from '@gym/i18n';
import Image from 'next/image';

import { TrackedLink } from '@/shared/ui/tracked-link';

/** Public product discovery, not a representation of a live signed-in dashboard. */
export function ProductDiscovery({ locale }: { locale: Locale }) {
  const t = getMessages(locale).landing.home;
  const products = [
    {
      name: 'OVRANTO Athlete',
      previewSrc: '/product-previews/athlete-workouts.webp',
      darkPreviewSrc: '/product-previews/athlete-workouts-dark.webp',
      previewAlt: t.productAthletePreviewAlt,
      audience: t.productAthleteAudience,
      description: t.productAthleteDescription,
      highlights: [
        t.productAthleteHighlightOne,
        t.productAthleteHighlightTwo,
        t.productAthleteHighlightThree,
      ],
      action: t.audienceAthletesAction,
      href: '/for-athletes',
    },
    {
      name: 'OVRANTO Coach',
      previewSrc: '/product-previews/coach-workspace.webp',
      darkPreviewSrc: '/product-previews/coach-workspace-dark.webp',
      previewAlt: t.productCoachPreviewAlt,
      audience: t.productCoachAudience,
      description: t.productCoachDescription,
      highlights: [
        t.productCoachHighlightOne,
        t.productCoachHighlightTwo,
        t.productCoachHighlightThree,
      ],
      action: t.audienceTrainersAction,
      href: '/for-trainers',
    },
  ] as const;

  return (
    <div className="landing-scroll-reveal mt-12 grid gap-6 lg:grid-cols-2">
      {products.map((product, index) => (
        <article
          key={product.href}
          className="landing-product-card group relative isolate flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-sm shadow-foreground/5 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 focus-within:border-primary/40 motion-reduce:transition-none"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rotate-12 rounded-[3rem] border-[18px] border-primary/10 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:rotate-[17deg]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--brand-terracotta)] via-primary to-transparent"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3 px-7 pt-8 sm:px-9">
            <span className="inline-flex min-h-10 items-center rounded-xl border border-primary/15 bg-primary/10 px-3 text-xs font-extrabold tracking-[0.18em] text-primary uppercase">
              {String(index + 1).padStart(2, '0')} / 02
            </span>
            <span className="rounded-full border border-border bg-secondary/85 px-3 py-1.5 text-xs font-semibold text-foreground">
              {t.productDevelopmentStatus}
            </span>
          </div>
          <div className="relative flex-1 px-7 pt-9 pb-8 sm:px-9">
            <p className="mb-3 text-xs font-bold tracking-[0.15em] text-muted-foreground uppercase">
              {product.audience}
            </p>
            <h3 className="border-l-[3px] border-[var(--brand-terracotta)] pl-4 text-3xl font-extrabold tracking-[-0.045em] text-foreground sm:text-4xl">
              {product.name}
            </h3>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              {product.description}
            </p>
            <figure className="landing-product-frame relative mt-8 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-primary/10 via-secondary/70 to-card p-3 shadow-lg shadow-foreground/10 ring-1 ring-primary/15 sm:p-4">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] bg-gradient-to-r from-[var(--brand-terracotta)] to-primary"
              />
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                <Image
                  src={product.previewSrc}
                  alt={product.previewAlt}
                  width={1200}
                  height={700}
                  sizes="(min-width: 1024px) 46vw, (min-width: 640px) 85vw, 100vw"
                  loading="lazy"
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  className="landing-product-preview--light landing-product-image h-auto w-full"
                />
                <Image
                  src={product.darkPreviewSrc}
                  alt={product.previewAlt}
                  width={1200}
                  height={700}
                  sizes="(min-width: 1024px) 46vw, (min-width: 640px) 85vw, 100vw"
                  loading="lazy"
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  className="landing-product-preview--dark landing-product-image h-auto w-full"
                />
              </div>
              <figcaption className="px-1 pt-3 pb-1 text-xs leading-5 text-muted-foreground">
                {t.productPreviewDisclaimer}
              </figcaption>
            </figure>
            <ul className="mt-8 grid gap-2" aria-label={t.productHighlightsLabel}>
              {product.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 text-sm font-semibold leading-6"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-[var(--brand-terracotta)]"
                  />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex flex-col gap-3 border-t border-border/80 bg-secondary/30 px-7 py-6 sm:px-9">
            <TrackedLink
              eventName="landing_feature_card"
              href={product.href}
              className="group/action inline-flex min-h-11 w-full items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {product.action}
              <span
                aria-hidden="true"
                data-slot="landing-product-arrow"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-card text-lg motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/action:translate-x-1 motion-safe:group-focus-visible/action:translate-x-1"
              >
                →
              </span>
            </TrackedLink>
            <p className="text-xs leading-5 text-muted-foreground">{t.productAvailabilityNotice}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
