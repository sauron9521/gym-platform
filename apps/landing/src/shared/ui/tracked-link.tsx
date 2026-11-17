'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';

import { recordLandingEvent, type LandingEventName } from '@/shared/lib/landing-analytics';

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: LandingEventName;
};

export function TrackedLink({ eventName, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          recordLandingEvent(eventName);
        }
      }}
    />
  );
}
