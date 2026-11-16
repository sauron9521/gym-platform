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
        <p className="text-sm font-bold tracking-widest text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 leading-7 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
