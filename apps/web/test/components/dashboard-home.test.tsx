import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DashboardHome, getDashboardShortcuts } from '@/widgets/dashboard/ui/dashboard-home';

afterEach(cleanup);

function dashboard(role: 'ATHLETE' | 'TRAINER' | 'ADMIN' = 'ATHLETE') {
  const onSignOut = vi.fn();
  const view = render(
    <DashboardHome
      displayName="Олексій"
      email="athlete@example.test"
      role={role}
      isSigningOut={false}
      signOutError={null}
      onSignOut={onSignOut}
    />,
  );
  return { ...view, onSignOut };
}

test('primary dashboard hero has a truthful create-workout destination', () => {
  dashboard();
  expect(screen.getByRole('heading', { level: 1, name: 'Вітаємо, Олексій!' })).toBeTruthy();
  const create = screen.getByRole('link', { name: 'Створити тренування' });
  const journal = screen.getByRole('link', { name: 'Відкрити журнал' });
  expect(create.getAttribute('href')).toBe('/workouts/new');
  expect(create.className).toContain('bg-[var(--brand-teal)]');
  expect(journal.getAttribute('href')).toBe('/workouts');
  expect(screen.getByRole('heading', { level: 2, name: 'Швидкий доступ' })).toBeTruthy();
});

test('shortcuts match verified athlete and trainer routes without privilege leaks', () => {
  expect(getDashboardShortcuts('ATHLETE').map((x) => x.href)).toEqual([
    '/exercises',
    '/profile',
    '/athlete/programs',
    '/athlete/trainers',
  ]);
  expect(getDashboardShortcuts('TRAINER').map((x) => x.href)).toEqual([
    '/exercises',
    '/profile',
    '/trainer/programs',
    '/trainer/athletes',
  ]);
  const adminRoutes = getDashboardShortcuts('ADMIN').map((shortcut) => shortcut.href);
  expect(adminRoutes).toEqual(['/exercises', '/profile']);
});

test('signed-in dashboard shows only links available for the role', () => {
  dashboard('TRAINER');
  const trainerLink = screen.getByRole('link', { name: 'Відкрити мої підопічні' });
  expect(trainerLink.getAttribute('href')).toBe('/trainer/athletes');
  expect(screen.queryByRole('link', { name: 'Відкрити мої тренери' })).toBeNull();
});

test('sign-out pending and error states stay adjacent to the control', () => {
  const { rerender, onSignOut } = dashboard();
  const button = screen.getByRole('button', { name: 'Вийти' });
  fireEvent.click(button);
  expect(onSignOut).toHaveBeenCalledOnce();

  rerender(
    <DashboardHome
      displayName="Олексій"
      email="athlete@example.test"
      role="ATHLETE"
      isSigningOut={true}
      signOutError="Не вдалося завершити сесію."
      onSignOut={onSignOut}
    />,
  );
  const pending = screen.getByRole('button', { name: 'Вихід…' }) as HTMLButtonElement;
  expect(pending.disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('Не вдалося завершити сесію.');
});

test('DashboardHome inserts optional private data section between hero and shortcuts', () => {
  const { container } = render(
    <DashboardHome
      displayName="Олексій"
      email="athlete@example.test"
      role="ATHLETE"
      isSigningOut={false}
      signOutError={null}
      onSignOut={vi.fn()}
    >
      <section data-testid="private-data">Реальні тренування</section>
    </DashboardHome>,
  );
  const main = container.querySelector('main');
  const child = screen.getByTestId('private-data');
  expect(main?.contains(child)).toBe(true);
  expect(child.compareDocumentPosition(screen.getByRole('heading', { name: 'Швидкий доступ' }))).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});
