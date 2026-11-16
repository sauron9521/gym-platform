import Link from 'next/link';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
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
            'rounded-3xl border border-primary/30 bg-primary/10 px-7 py-12',
            'sm:px-12 sm:py-16',
          )}
        >
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
            {secondary ? (
              <Button asChild size="lg" variant="outline">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Container>
    </MarketingSection>
  );
}
