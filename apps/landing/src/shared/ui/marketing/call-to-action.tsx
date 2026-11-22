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
            'relative isolate overflow-hidden rounded-[2rem] bg-primary px-7 py-12 text-primary-foreground shadow-xl shadow-foreground/10',
            'sm:px-12 sm:py-16',
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 -z-10 h-full w-1/2 opacity-20"
            style={{
              background:
                'radial-gradient(circle at 90% 20%, var(--primary-foreground), transparent 68%)',
            }}
          />
          <div
            aria-hidden="true"
            className="mb-8 h-1.5 w-14 rounded-full bg-[var(--brand-terracotta)]"
          />
          <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-primary-foreground/85">
            {description}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="touch" variant="secondary" className="rounded-xl px-6 font-bold">
              <TrackedLink eventName="landing_primary_cta" href={primary.href}>
                {primary.label}
              </TrackedLink>
            </Button>
            {secondary ? (
              <Button
                asChild
                size="touch"
                variant="outline"
                className="rounded-xl border-primary-foreground/40 bg-transparent px-6 font-bold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <TrackedLink eventName="landing_secondary_cta" href={secondary.href}>
                  {secondary.label}
                </TrackedLink>
              </Button>
            ) : null}
          </div>
        </div>
      </Container>
    </MarketingSection>
  );
}
