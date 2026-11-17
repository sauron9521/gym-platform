import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TrackedLink } from '../../src/shared/ui/tracked-link';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  delete window.umami;
});

test('opt-in analytics never blocks navigation when provider is absent', () => {
  render(
    <TrackedLink href="/features" eventName="landing_primary_cta">
      Features
    </TrackedLink>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Features' }));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/features');
});

test('analytics sends a bounded event name and no user data when configured', () => {
  const track = vi.fn();
  window.umami = { track };
  render(
    <TrackedLink href="/apps" eventName="landing_secondary_cta">
      Apps
    </TrackedLink>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Apps' }));
  expect(track).toHaveBeenCalledExactlyOnceWith('landing_secondary_cta');
});

test('cancelled navigation does not send conversion events', () => {
  const track = vi.fn();
  window.umami = { track };
  render(
    <TrackedLink
      href="/apps"
      eventName="landing_primary_cta"
      onClick={(event) => event.preventDefault()}
    >
      Cancelled
    </TrackedLink>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Cancelled' }));
  expect(track).not.toHaveBeenCalled();
});

test('provider exceptions cannot interrupt tracked link clicks', () => {
  const track = vi.fn(() => {
    throw new Error('provider unavailable');
  });
  window.umami = { track };
  render(
    <TrackedLink href="/features" eventName="landing_feature_card">
      Safe link
    </TrackedLink>,
  );
  expect(() => fireEvent.click(screen.getByRole('link', { name: 'Safe link' }))).not.toThrow();
  expect(track).toHaveBeenCalledExactlyOnceWith('landing_feature_card');
  expect(screen.getByRole('link', { name: 'Safe link' }).getAttribute('href')).toBe('/features');
});
