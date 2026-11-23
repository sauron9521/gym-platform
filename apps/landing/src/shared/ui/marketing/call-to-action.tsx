import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { TrackedLink } from '@/shared/ui/tracked-link';
import { Container } from './container';
import { MarketingSection } from './marketing-section';

type CallToActionLink = {
  href: string;
  label: string;
};

type CallToActionProps = {
  title: string;
  description: string;
  primary: CallToActionLink;
  secondary?: CallToActionLink;
  className?: string;
};

export function CallToAction({
  title,
  description,
  primary,
  secondary,
  className,
}: CallToActionProps) {
  return (
    <MarketingSection aria-label={title} className={className}>
      <Container>
        <div
          className={cn(
            'landing-cta-surface group relative isolate overflow-hidden rounded-[2rem] bg-primary px-7 py-12 text-primary-foreground shadow-xl shadow-foreground/10 ring-1 ring-primary/20',
            'sm:px-12 sm:py-16 lg:px-14 lg:py-20',
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--brand-terracotta)] via-primary-foreground/50 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full border-[22px] border-primary-foreground/10 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-6"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -bottom-36 size-64 rounded-full border-[18px] border-[var(--brand-terracotta)]/20"
          />
          <div className="relative z-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <div
                aria-hidden="true"
                className="mb-8 h-1.5 w-14 rounded-full bg-[var(--brand-terracotta)]"
              />
              <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-0.045em] text-balance sm:text-5xl">
                {title}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-primary-foreground/85">
                {description}
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                size="touch"
                variant="secondary"
                className="landing-cta-action group/action min-w-0 justify-between gap-4 rounded-xl px-6 font-bold shadow-sm sm:flex-1 lg:flex-none"
              >
                <TrackedLink eventName="landing_primary_cta" href={primary.href}>
                  {primary.label}
                  <span
                    aria-hidden="true"
                    data-slot="landing-cta-arrow"
                    className="shrink-0 text-lg motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/action:translate-x-1 motion-safe:group-focus-visible/action:translate-x-1"
                  >
                    →
                  </span>
                </TrackedLink>
              </Button>
              {secondary ? (
                <Button
                  asChild
                  size="touch"
                  variant="outline"
                  className="landing-cta-action group/action min-w-0 justify-between gap-4 rounded-xl border-primary-foreground/40 bg-transparent px-6 font-bold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:flex-1 lg:flex-none"
                >
                  <TrackedLink eventName="landing_secondary_cta" href={secondary.href}>
                    {secondary.label}
                    <span
                      aria-hidden="true"
                      data-slot="landing-cta-arrow"
                      className="shrink-0 text-lg motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/action:translate-x-1 motion-safe:group-focus-visible/action:translate-x-1"
                    >
                      →
                    </span>
                  </TrackedLink>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </MarketingSection>
  );
}
