import { createElement, type ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { HomeScreen } from '../../src/widgets/home/ui/home-screen';

// Server-side next/image is mocked as an ordinary image in component tests only.
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; width: number; height: number; loading?: string }) =>
    createElement('img', props),
}));

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
  expect(screen.getByRole('link', { name: 'Для атлетів' }).getAttribute('href')).toBe(
    '/for-athletes',
  );
  expect(screen.getByRole('link', { name: 'Для тренерів' }).getAttribute('href')).toBe(
    '/for-trainers',
  );
});

test('English homepage uses translated headings, CTAs, cards, milestones and ARIA text', () => {
  render(<HomeScreen locale="en" />);

  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Train smarter.');
  expect(screen.getByRole('heading', { name: 'From planning to progress' })).toBeTruthy();
  expect(screen.getByRole('img', { name: /Illustration of a workout plan/ })).toBeTruthy();
  expect(screen.getByText('Concept')).toBeTruthy();
  expect(screen.getByText(/actively being developed/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'For athletes' }).getAttribute('href')).toBe(
    '/for-athletes',
  );
  expect(screen.getByRole('link', { name: 'For coaches' }).getAttribute('href')).toBe(
    '/for-trainers',
  );
  expect(screen.getByRole('link', { name: 'Explore products' }).getAttribute('href')).toBe('/apps');
  expect(screen.getByRole('link', { name: 'About the project' }).getAttribute('href')).toBe(
    '/about',
  );
  expect(screen.getByRole('heading', { name: 'Choose exercises' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Build a plan' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Track results' })).toBeTruthy();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  const athletePreviews = screen.getAllByRole('img', { name: /actual OVRANTO Athlete interface/ });
  const coachPreviews = screen.getAllByRole('img', { name: /actual OVRANTO Coach interface/ });
  expect(athletePreviews).toHaveLength(2);
  expect(coachPreviews).toHaveLength(2);
  const [athletePreview, athleteDarkPreview] = athletePreviews;
  const [coachPreview, coachDarkPreview] = coachPreviews;
  expect(decodeURIComponent(athletePreview.getAttribute('src') ?? '')).toContain(
    '/product-previews/athlete-workouts.webp',
  );
  expect(decodeURIComponent(coachPreview.getAttribute('src') ?? '')).toContain(
    '/product-previews/coach-workspace.webp',
  );
  expect(athletePreview.getAttribute('loading')).toBe('lazy');
  expect(coachPreview.getAttribute('loading')).toBe('lazy');
  expect(athleteDarkPreview.getAttribute('src')).toContain('athlete-workouts-dark.webp');
  expect(coachDarkPreview.getAttribute('src')).toContain('coach-workspace-dark.webp');
  expect(athleteDarkPreview.getAttribute('loading')).toBe('lazy');
  // Prioritize only the potential first-card LCP; Coach remains a secondary asset.
  expect(athletePreview.getAttribute('fetchpriority')).toBe('high');
  expect(athleteDarkPreview.getAttribute('fetchpriority')).toBe('high');
  expect(coachPreview.getAttribute('fetchpriority')).toBe('auto');
  expect(coachDarkPreview.getAttribute('fetchpriority')).toBe('auto');
  expect(coachDarkPreview.getAttribute('loading')).toBe('lazy');
  expect(screen.getAllByText(/records and metrics are synthetic/)).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'OVRANTO Athlete' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'OVRANTO Coach' })).toBeTruthy();
  expect(screen.getAllByText('In development')).toHaveLength(2);
  expect(screen.getByText('Assign plans to athletes')).toBeTruthy();
  expect(screen.getAllByText(/Public access has not been announced/)).toHaveLength(2);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});
