import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

type MarketingSectionProps = ComponentProps<'section'> & {
  tone?: 'default' | 'subtle';
};

export function MarketingSection({ className, tone = 'default', ...props }: MarketingSectionProps) {
  return (
    <section
      className={cn(
        'py-20 sm:py-24',
        tone === 'subtle' && 'border-y border-border/70 bg-card/30',
        className,
      )}
      {...props}
    />
  );
}
