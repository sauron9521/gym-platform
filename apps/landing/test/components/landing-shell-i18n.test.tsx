import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { getMessages } from '@gym/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { applicationNavigation, mainNavigation } from '../../src/shared/config/navigation';
import { getLandingNavigation } from '../../src/shared/lib/landing-navigation';
import { SiteFooter } from '../../src/widgets/layout/ui/site-footer';
import { SiteHeader } from '../../src/widgets/layout/ui/site-header';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  >) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function checkLinks(nav: HTMLElement, items: ReadonlyArray<{ label: string; href: string }>) {
  for (const { href, label } of items) {
    expect(within(nav).getByRole('link', { name: label }).getAttribute('href')).toBe(href);
  }
}

describe('Landing shared shell i18n', () => {
  test.each(['uk', 'en'] as const)('%s navigation preserves all public hrefs', (locale) => {
    const { main, applications, nav } = getLandingNavigation(locale);
    expect(main.map((x) => x.href)).toEqual(mainNavigation.map((x) => x.href));
    expect(applications.map((x) => x.href)).toEqual(applicationNavigation.map((x) => x.href));
    expect(main.map((x) => x.label)).toEqual([nav.features, nav.athletes, nav.trainers, nav.about]);
    expect(main.every((x) => x.label.length > 0)).toBe(true);
  });

  test.each(['uk', 'en'] as const)(
    '%s header shares labels across desktop and mobile',
    (locale) => {
      const { main, nav, shell } = getLandingNavigation(locale);
      render(<SiteHeader locale={locale} />);
      const home = screen.getByRole('link', { name: 'OVRANTO — ' + shell.homeAria });
      expect(home.getAttribute('href')).toBe('/');
      const desktop = screen.getByRole('navigation', { name: shell.mainNav });
      const mobile = screen.getByRole('navigation', { name: shell.mobileNav });
      checkLinks(desktop, main);
      checkLinks(mobile, main);
      expect(within(desktop).getAllByRole('link')).toHaveLength(mainNavigation.length);
      expect(within(mobile).getByRole('link', { name: nav.apps }).getAttribute('href')).toBe(
        '/apps',
      );
      expect(screen.getAllByRole('link', { name: nav.apps })).toHaveLength(2);
      expect(screen.getByText(shell.menu).closest('summary')).not.toBeNull();
    },
  );

  test.each(['uk', 'en'] as const)('%s footer translates all UI labels', (locale) => {
    const { main, applications, shell } = getLandingNavigation(locale);
    const common = getMessages(locale).landing.common;
    render(<SiteFooter locale={locale} />);
    expect(screen.getByText(shell.summary)).toBeTruthy();
    expect(screen.getByRole('heading', { name: shell.platform })).toBeTruthy();
    checkLinks(screen.getByRole('navigation', { name: shell.sectionsNav }), main);
    const apps = screen.getByRole('navigation', { name: shell.applications });
    checkLinks(apps, applications);
    expect(
      within(apps).getByRole('link', { name: common.allApplications }).getAttribute('href'),
    ).toBe('/apps');
    expect(screen.getByText(new RegExp(shell.inDevelopment))).toBeTruthy();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeTruthy();
  });

  test('explicit English locale never leaks original Ukrainian navigation labels', () => {
    render(
      <>
        <SiteHeader locale="en" />
        <SiteFooter locale="en" />
      </>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Site sections' })).toBeTruthy();
    expect(screen.getByText('All applications')).toBeTruthy();
    expect(screen.getByText('Web application')).toBeTruthy();
    expect(screen.getByText('Mobile application')).toBeTruthy();
    expect(screen.queryByText('Можливості')).toBeNull();
    expect(screen.queryByText('Усі застосунки')).toBeNull();
  });

  test('Ukrainian remains the default and routes are not localized in this PR', () => {
    render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    );
    expect(screen.getByRole('navigation', { name: 'Основна навігація' })).toBeTruthy();
    expect(screen.getByText('Меню')).toBeTruthy();
    expect(screen.getByText('Усі застосунки')).toBeTruthy();
    const mobile = screen.getByRole('navigation', { name: 'Мобільна навігація' });
    expect(within(mobile).getByRole('link', { name: 'Застосунки' }).getAttribute('href')).toBe(
      '/apps',
    );
  });

  test('English mobile menu Escape closes disclosure and restores focus', () => {
    render(<SiteHeader locale="en" />);
    const summary = screen.getByText('Menu').closest('summary');
    const details = summary?.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    fireEvent.click(summary as HTMLElement);
    expect(details?.hasAttribute('open')).toBe(true);
    fireEvent.keyDown(details as HTMLElement, { key: 'Escape' });
    expect(details?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  test('switching language does not change route URLs or navigation count', () => {
    const view = render(<SiteHeader locale="en" />);
    const english = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(english).getAllByRole('link')).toHaveLength(4);
    view.rerender(<SiteHeader locale="uk" />);
    const ukrainian = screen.getByRole('navigation', { name: 'Основна навігація' });
    checkLinks(ukrainian, getLandingNavigation('uk').main);
    expect(within(ukrainian).getAllByRole('link')).toHaveLength(4);
  });
});
