import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

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

afterEach(cleanup);

const links = [
  { href: '/dashboard', label: 'Кабінет' },
  { href: '/workouts', label: 'Тренування' },
  { href: '/exercises', label: 'Вправи' },
  { href: '/profile', label: 'Профіль' },
];

function renderShell() {
  return render(
    <AthleteShell
      links={links}
      navigationLabel="Особистий кабінет"
      locale="uk"
      initialPreference="system"
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
