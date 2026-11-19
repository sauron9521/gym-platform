import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { parseSidebarCollapsed, SIDEBAR_COOKIE_NAME } from '@/shared/lib/sidebar-preference';
import { AthleteShell, isCurrentNavigationLink } from '@/widgets/athlete-shell/ui/athlete-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workouts/create',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/shared/ui/theme-switcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock('@/shared/ui/locale-switcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

afterEach(() => {
  cleanup();
  document.cookie = SIDEBAR_COOKIE_NAME + '=; Path=/; Max-Age=0';
});

const links = [
  { href: '/dashboard', label: 'Кабінет' },
  { href: '/workouts', label: 'Тренування' },
  { href: '/exercises', label: 'Вправи' },
  { href: '/profile', label: 'Профіль' },
];

function renderShell(initialCollapsed = false) {
  return render(
    <AthleteShell
      links={links}
      navigationLabel="Особистий кабінет"
      locale="uk"
      initialPreference="system"
      initialCollapsed={initialCollapsed}
    >
      <main>Захищена сторінка</main>
    </AthleteShell>,
  );
}

test('navigation highlights nested routes without matching unrelated prefixes', () => {
  expect(isCurrentNavigationLink('/workouts/create', '/workouts')).toBe(true);
  expect(isCurrentNavigationLink('/workouts', '/workouts')).toBe(true);
  expect(isCurrentNavigationLink('/workouts-copy', '/workouts')).toBe(false);
  expect(isCurrentNavigationLink('/trainer/workouts', '/workouts')).toBe(false);
});

test('desktop sidebar keeps existing routes and server-rendered content', () => {
  renderShell();
  const desktopNav = screen.getAllByRole('navigation', { name: 'Особистий кабінет' })[0];
  expect(within(desktopNav).getAllByRole('link')).toHaveLength(4);
  const active = within(desktopNav).getByRole('link', { name: 'Тренування' });
  expect(active.getAttribute('aria-current')).toBe('page');
  expect(screen.getByText('Захищена сторінка')).toBeTruthy();
  expect(screen.getByTestId('theme-switcher')).toBeTruthy();
  expect(screen.getByTestId('locale-switcher')).toBeTruthy();
});

test('brand home link accessible names include the visible OVRANTO tagline', () => {
  renderShell();
  const brandLinks = screen.getAllByRole('link', {
    name: 'OVRANTO PERFORMANCE PLATFORM — головна',
  });
  expect(brandLinks).toHaveLength(2);
  for (const link of brandLinks) {
    expect(link.textContent).toContain('OVRANTO');
  }
  const desktopLink = brandLinks.find((link) => link.className.includes('mb-10'));
  expect(desktopLink?.textContent).toContain('OVRANTO PERFORMANCE PLATFORM');
});

test('mobile navigation opens, closes on Escape and restores keyboard focus', () => {
  renderShell();
  const open = screen.getByRole('button', { name: 'Відкрити навігацію' });
  const id = open.getAttribute('aria-controls');
  const menu = document.getElementById(id ?? '');
  expect(menu?.hidden).toBe(true);

  fireEvent.click(open);
  const close = screen.getByRole('button', { name: 'Закрити навігацію' });
  expect(close.getAttribute('aria-expanded')).toBe('true');
  expect(menu?.hidden).toBe(false);
  fireEvent.keyDown(screen.getByTestId('athlete-shell-header'), { key: 'Escape' });
  expect(menu?.hidden).toBe(true);
  expect(document.activeElement).toBe(open);
});

test('sidebar parser rejects unknown cookie values', () => {
  expect(parseSidebarCollapsed(undefined)).toBe(false);
  expect(parseSidebarCollapsed('expanded')).toBe(false);
  expect(parseSidebarCollapsed('invalid')).toBe(false);
  expect(parseSidebarCollapsed('collapsed')).toBe(true);
});

test('desktop sidebar toggles compact mode with accessible links', () => {
  const { container } = renderShell();
  const root = container.querySelector('[data-sidebar-collapsed]');
  const desktop = screen.getAllByRole('navigation', { name: 'Особистий кабінет' })[0];

  expect(root?.getAttribute('data-sidebar-collapsed')).toBe('false');
  const collapse = screen.getByRole('button', { name: 'Згорнути бічну панель' });
  expect(collapse.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(collapse);

  expect(root?.getAttribute('data-sidebar-collapsed')).toBe('true');
  expect(root?.className).toContain('lg:grid-cols-[5.5rem_minmax(0,1fr)]');
  expect(document.cookie).toContain(SIDEBAR_COOKIE_NAME + '=collapsed');
  const active = within(desktop).getByRole('link', { name: 'Тренування' });
  expect(active.getAttribute('title')).toBe('Тренування');
  expect(active.getAttribute('aria-current')).toBe('page');
  expect(within(desktop).getAllByRole('link')).toHaveLength(4);

  fireEvent.click(screen.getByRole('button', { name: 'Розгорнути бічну панель' }));
  expect(root?.getAttribute('data-sidebar-collapsed')).toBe('false');
  expect(document.cookie).toContain(SIDEBAR_COOKIE_NAME + '=expanded');
});

test('server provided collapsed preference applies before first paint', () => {
  const { container } = renderShell(true);
  const root = container.querySelector('[data-sidebar-collapsed]');
  expect(root?.getAttribute('data-sidebar-collapsed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Розгорнути бічну панель' })).toBeTruthy();
  expect(screen.getAllByRole('navigation', { name: 'Особистий кабінет' })).toHaveLength(1);
});
