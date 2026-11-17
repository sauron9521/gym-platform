import type { ReactNode } from 'react';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@gym/ui-web';

import { cn } from '@/shared/lib/utils';
import { TrackedLink } from '@/shared/ui/tracked-link';

type FeatureCardProps = {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  icon?: ReactNode;
  className?: string;
};

export function FeatureCard({
  title,
  description,
  href,
  linkLabel,
  icon,
  className,
}: FeatureCardProps) {
  return (
    <article className={cn('h-full', className)}>
      <Card className="flex h-full flex-col transition-colors hover:border-primary/40 focus-within:border-primary/40">
        <CardHeader className="flex-1">
          <div aria-hidden="true" className="mb-5 flex h-8 items-center text-primary">
            {icon ?? <span className="h-1 w-12 rounded-full bg-primary" />}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="pt-1 leading-7">{description}</CardDescription>
        </CardHeader>
        <CardFooter>
          <TrackedLink
            eventName="landing_feature_card"
            href={href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {linkLabel} <span aria-hidden="true">→</span>
          </TrackedLink>
        </CardFooter>
      </Card>
    </article>
  );
}
