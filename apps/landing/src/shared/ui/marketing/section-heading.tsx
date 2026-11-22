import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? (
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h2
        id={id}
        className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
