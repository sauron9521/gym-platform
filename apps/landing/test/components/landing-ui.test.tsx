import { createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { applicationNavigation, mainNavigation } from '../../src/shared/config/navigation';
import { IntroPage } from '../../src/widgets/content/ui/intro-page';
import { HomeScreen } from '../../src/widgets/home/ui/home-screen';
import { SiteFooter } from '../../src/widgets/layout/ui/site-footer';
import { SiteHeader } from '../../src/widgets/layout/ui/site-header';

// Link destinations are tested as anchors; Next's client router is not needed.
// Server-side next/image is mocked as an ordinary image in component tests only.
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; width: number; height: number; loading?: string }) =>
    createElement('img', props),
}));

vi.mock('next/link', () => ({
  default: function LinkStub({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  >) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

function expectLinks(
  navigation: HTMLElement,
  items: ReadonlyArray<{ label: string; href: string }>,
) {
  for (const { label, href } of items) {
    expect(within(navigation).getByRole('link', { name: label }).getAttribute('href')).toBe(href);
  }
}

describe('Landing site header', () => {
  test('provides a named home link and the complete desktop navigation', () => {
    render(<SiteHeader />);

    const home = screen.getByRole('link', { name: 'OVRANTO — головна сторінка' });
    expect(home.getAttribute('href')).toBe('/');

    const nav = screen.getByRole('navigation', { name: 'Основна навігація' });
    expectLinks(nav, mainNavigation);
    expect(within(nav).getAllByRole('link')).toHaveLength(mainNavigation.length);
    expect(screen.getAllByRole('link', { name: 'Продукти' })).toHaveLength(2);
  });

  test('mobile menu exposes all site destinations and an applications shortcut', () => {
    render(<SiteHeader />);

    const mobile = screen.getByRole('navigation', { name: 'Мобільна навігація' });
    expectLinks(mobile, mainNavigation);
    const directoryLink = within(mobile).getByRole('link', { name: 'Продукти' });
    expect(directoryLink.getAttribute('href')).toBe('/apps');

    const summary = screen.getByText('Меню').closest('summary');
    expect(summary).not.toBeNull();
    expect(summary?.closest('details')).not.toBeNull();
  });

  test('menu disclosure toggles through a pointer interaction without JavaScript state', () => {
    render(<SiteHeader />);

    const summary = screen.getByText('Меню').closest('summary');
    const details = summary?.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    fireEvent.click(summary as HTMLElement);
    expect(details?.hasAttribute('open')).toBe(true);
  });
});

describe('Landing home screen', () => {
  test('renders a single primary heading and reachable audience actions', () => {
    render(<HomeScreen />);

    const main = screen.getByRole('main');
    expect(main.getAttribute('id')).toBe('main-content');
    expect(within(main).getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole('heading', { level: 1 }).textContent).toContain(
      'Тренуйся розумніше.',
    );
    expect(within(main).getByRole('link', { name: 'Для атлетів' }).getAttribute('href')).toBe(
      '/for-athletes',
    );
    expect(within(main).getByRole('link', { name: 'Для тренерів' }).getAttribute('href')).toBe(
      '/for-trainers',
    );
  });

  test('product discovery cards link to athlete and coach overviews without launch promises', () => {
    render(<HomeScreen />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    for (const [index, name, label, href] of [
      [0, 'OVRANTO Athlete', 'Можливості спортсмена', '/for-athletes'],
      [1, 'OVRANTO Coach', 'Можливості тренера', '/for-trainers'],
    ] as const) {
      expect(within(cards[index]).getByRole('heading', { name })).toBeTruthy();
      expect(within(cards[index]).getByText('У розробці')).toBeTruthy();
      expect(within(cards[index]).getByText(/Публічний доступ ще не оголошено/)).toBeTruthy();
      expect(within(cards[index]).getAllByRole('listitem')).toHaveLength(3);
      const imageVariants = within(cards[index]).getAllByRole('img');
      expect(imageVariants).toHaveLength(2);
      expect(imageVariants[0].getAttribute('alt')).toMatch(/тестов/);
      expect(imageVariants[1].getAttribute('alt')).toBe(imageVariants[0].getAttribute('alt'));
      expect(within(cards[index]).getByText(/не реальна статистика користувачів/)).toBeTruthy();
      expect(within(cards[index]).getByRole('link', { name: label }).getAttribute('href')).toBe(
        href,
      );
    }
  });

  test('does not present planned capabilities as already available', () => {
    render(<HomeScreen />);

    expect(screen.getByText(/Платформа в активній розробці/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Платформа для твоїх цілей' })).toBeTruthy();
  });
});

describe('Landing footer and secondary page', () => {
  test('footer shows accessible section and application navigation with real routes', () => {
    render(<SiteFooter />);

    expectLinks(screen.getByRole('navigation', { name: 'Розділи сайту' }), mainNavigation);
    const appsNav = screen.getByRole('navigation', { name: 'Застосунки' });
    expectLinks(appsNav, applicationNavigation);
    const directoryLink = within(appsNav).getByRole('link', { name: 'Продукти' });
    expect(directoryLink.getAttribute('href')).toBe('/apps');
  });

  test('footer includes a home link and the current year', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'OVRANTO' }).getAttribute('href')).toBe('/');
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeTruthy();
  });

  test('secondary page uses a single heading and a functional return link', () => {
    render(
      <IntroPage
        eyebrow="Можливості платформи"
        title="Тренування, програми й прогрес"
        description="Планування тренувань і бібліотека вправ."
      />,
    );

    expect(screen.getByRole('main').getAttribute('id')).toBe('main-content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Тренування, програми й прогрес' })).toBeTruthy();
    expect(screen.getByText('Планування тренувань і бібліотека вправ.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'На головну' }).getAttribute('href')).toBe('/');
  });

  test('secondary page explicitly labels unfinished product content', () => {
    render(<IntroPage eyebrow="Про продукт" title="Про Gym" description="Опис проєкту." />);

    expect(screen.getByText(/Цей розділ готується/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'На головну' })).toBeTruthy();
  });
});
