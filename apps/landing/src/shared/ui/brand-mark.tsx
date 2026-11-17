import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

export function BrandMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('size-9 text-primary', className)}
      {...props}
    >
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <g stroke="var(--primary-foreground)" strokeLinecap="round" strokeWidth="4">
        <path d="M17 24h14" />
        <path d="M13 17v14M17 19v10M31 19v10M35 17v14" />
      </g>
    </svg>
  );
}
