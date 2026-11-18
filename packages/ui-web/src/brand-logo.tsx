import type { ComponentProps } from 'react';

import { cn } from './utils';

export type BrandLogoProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** Keep navigation/compact contexts readable without changing semantic heading structure. */
  showTagline?: boolean;
};

/**
 * Visual mark from assets/brand/mark.svg + real HTML wordmark.
 *
 * The artwork stays decorative, while OVRANTO is selectable/indexable text.
 * Wrap with the consumer's router link; do not use an h1 in app-wide headers.
 * Brand colors intentionally remain fixed across Light and Dark themes.
 */
export function BrandLogo({ className, showTagline = true, ...props }: BrandLogoProps) {
  return (
    <span
      data-slot="brand-logo"
      className={cn('inline-flex items-center gap-2.5 text-foreground', className)}
      {...props}
    >
      <svg
        data-slot="brand-mark"
        viewBox="0 0 90 68"
        aria-hidden="true"
        focusable="false"
        className="h-9 w-12 shrink-0"
      >
        <path d="M5 55 38 12H65L32 55Z" fill="#075C55" />
        <path d="M37 55 67 18H85L55 55Z" fill="#C76537" />
      </svg>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-lg font-semibold tracking-[-0.035em]">OVRANTO</span>
        {showTagline ? (
          <span
            aria-hidden="true"
            className="mt-1 text-[9px] font-medium tracking-[0.075em] text-muted-foreground"
          >
            PERFORMANCE PLATFORM
          </span>
        ) : null}
      </span>
    </span>
  );
}
