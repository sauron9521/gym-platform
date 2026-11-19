import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { HomeScreen } from '../../src/widgets/home/ui/home-screen';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

test('homepage explains the process and labels design previews honestly', () => {
  render(<HomeScreen />);
  expect(screen.getByRole('heading', { name: 'Від плану до наступного результату' })).toBeTruthy();
  expect(screen.getByText(/не реальні дані спортсмена/)).toBeTruthy();
  expect(screen.getByRole('img', { name: /Умовний макет тренувального плану/ })).toBeTruthy();
  expect(screen.getByText('Макет')).toBeTruthy();
  expect(screen.getByText(/Рання стадія розробки/)).toBeTruthy();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Переглянути продукти' }).getAttribute('href')).toBe(
    '/apps',
  );
});

test('English homepage uses translated headings, CTAs, cards, milestones and ARIA text', () => {
  render(<HomeScreen locale="en" />);

  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Train smarter.');
  expect(screen.getByRole('heading', { name: 'From planning to progress' })).toBeTruthy();
  expect(screen.getByRole('img', { name: /Illustration of a workout plan/ })).toBeTruthy();
  expect(screen.getByText('Concept')).toBeTruthy();
  expect(screen.getByText(/actively being developed/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Explore applications' }).getAttribute('href')).toBe(
    '/apps',
  );
  expect(screen.getByRole('link', { name: 'Explore products' }).getAttribute('href')).toBe(
    '/apps',
  );
  expect(screen.getByRole('link', { name: 'About the project' }).getAttribute('href')).toBe(
    '/about',
  );
  expect(screen.getByRole('heading', { name: 'Choose exercises' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Build a plan' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Track results' })).toBeTruthy();
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});
