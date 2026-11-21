import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import FeaturesPage from '../../src/app/features/page';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('Landing Features page', () => {
  it('preserves Ukrainian copy on the original unprefixed page', () => {
    render(<FeaturesPage />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Більше контролю над кожним тренуванням',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Можливості платформи')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Усе, що допомагає прогресувати' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Переглянути застосунки' }).getAttribute('href')).toBe(
      '/apps',
    );
    expect(screen.getByRole('heading', { name: 'Програми та версії' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Тренер і спортсмен' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Я спортсмен' }).getAttribute('href')).toBe(
      '/for-athletes',
    );
    expect(screen.getByRole('link', { name: 'Я тренер' }).getAttribute('href')).toBe(
      '/for-trainers',
    );
  });

  it('fully translates Features headings, descriptions, cards and CTA into English', () => {
    render(<FeaturesPage locale="en" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'More control over every workout' }),
    ).toBeTruthy();
    expect(screen.getByText('Platform features')).toBeTruthy();
    expect(screen.getByText(/Some features are still in development/)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Everything you need to make progress' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Exercise library' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Workout log' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Programs and versions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coach and athlete' })).toBeTruthy();
    expect(screen.getByText('Organize training with evolving programs and versions.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explore applications' }).getAttribute('href')).toBe(
      '/apps',
    );
    expect(screen.getByRole('link', { name: "I'm an athlete" }).getAttribute('href')).toBe(
      '/for-athletes',
    );
    expect(screen.getByRole('link', { name: "I'm a coach" }).getAttribute('href')).toBe(
      '/for-trainers',
    );
    expect(screen.queryByText('Можливості платформи')).toBeNull();
    expect(screen.queryByText('Тренер і спортсмен')).toBeNull();
  });

  it('keeps the same four feature cards and destination paths in both languages', () => {
    const view = render(<FeaturesPage locale="uk" />);
    const ukCards = screen.getAllByRole('article');
    expect(ukCards).toHaveLength(4);
    const ukHrefs = ukCards.map((card) => within(card).getByRole('link').getAttribute('href'));
    expect(ukHrefs).toEqual(['/for-athletes', '/for-athletes', '/for-trainers', '/for-trainers']);
    view.rerender(<FeaturesPage locale="en" />);
    const enCards = screen.getAllByRole('article');
    expect(enCards).toHaveLength(4);
    expect(enCards.map((card) => within(card).getByRole('link').getAttribute('href'))).toEqual(
      ukHrefs,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
