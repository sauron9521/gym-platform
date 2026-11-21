'use client';

import type { ReactNode } from 'react';

import { cn } from './utils';

/** Accessible feedback for pending/success/error/empty read and write states. */
export type AsyncFeedbackState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export function AsyncFeedback({
  state,
  message,
  onRetry,
  retryLabel,
  retryDisabled = false,
  className,
  children,
}: {
  state: AsyncFeedbackState;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Parent request state controls whether another retry is allowed. */
  retryDisabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  if (state === 'idle') return null;

  return (
    <div
      data-slot="async-feedback"
      data-state={state}
      role={state === 'error' ? 'alert' : 'status'}
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      aria-busy={state === 'loading'}
      className={cn(
        'rounded-lg border border-border bg-card p-3 text-sm text-card-foreground',
        state === 'error' && 'border-destructive/50',
        className,
      )}
    >
      <p>{message}</p>
      {children}
      {state === 'error' && onRetry && retryLabel ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className="mt-2 min-h-9 rounded-md border border-border px-3 py-2 font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
