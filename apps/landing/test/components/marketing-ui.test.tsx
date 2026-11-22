import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import {
  CallToAction,
  Container,
  FeatureCard,
  MarketingSection,
  SectionHeading,
} from '../../src/shared/ui/marketing';

vi.mock('next/link', () => ({
  default: function LinkStub({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href}>{children}</a>;
  },
}));

afterEach(cleanup);

describe('Landing marketing primitives', () => {
  test('container passes through attributes and custom classes', () => {
    render(
      <Container data-testid="container" className="custom-class">
        Контент
      </Container>,
    );

    const container = screen.getByTestId('container');
    expect(container.className).toContain('max-w-6xl');
    expect(container.className).toContain('custom-class');
    expect(container.textContent).toBe('Контент');
  });

  test('section provides semantic structure and optional subtle surface', () => {
    render(
      <MarketingSection aria-label="Секція" tone="subtle">
        <p>Опис</p>
      </MarketingSection>,
    );

    const section = screen.getByRole('region', { name: 'Секція' });
    expect(section.tagName).toBe('SECTION');
    expect(section.className).toContain('bg-secondary/40');
  });

  test('heading keeps a semantic h2 and works with section labelling', () => {
    render(
      <MarketingSection aria-labelledby="capabilities">
        <SectionHeading
          id="capabilities"
          eyebrow="Переваги"
          title="Усі можливості"
          description="Опис можливостей."
          align="center"
        />
      </MarketingSection>,
    );

    const section = screen.getByRole('region', { name: 'Усі можливості' });
    expect(within(section).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(screen.getByText('Переваги')).toBeTruthy();
    expect(screen.getByText('Опис можливостей.')).toBeTruthy();
  });

  test('feature card exposes a heading, description and accessible destination', () => {
    render(
      <FeatureCard
        title="Тренування"
        description="Записуйте свої результати."
        href="/features"
        linkLabel="Дізнатися більше"
        icon={<span>Іконка</span>}
      />,
    );

    const article = screen.getByRole('article');
    expect(within(article).getByRole('heading', { name: 'Тренування' })).toBeTruthy();
    expect(within(article).getByText('Записуйте свої результати.')).toBeTruthy();
    expect(
      within(article).getByRole('link', { name: 'Дізнатися більше' }).getAttribute('href'),
    ).toBe('/features');
    expect(within(article).queryByText('Іконка')).toBeTruthy();
  });

  test('CTA exposes primary and optional secondary links', () => {
    render(
      <CallToAction
        title="Готові почати?"
        description="Огляд доступних можливостей."
        primary={{ href: '/apps', label: 'Переглянути застосунки' }}
        secondary={{ href: '/features', label: 'Можливості' }}
      />,
    );

    const cta = screen.getByRole('region', { name: 'Готові почати?' });
    expect(within(cta).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(
      within(cta).getByRole('link', { name: 'Переглянути застосунки' }).getAttribute('href'),
    ).toBe('/apps');
    expect(within(cta).getByRole('link', { name: 'Можливості' }).getAttribute('href')).toBe(
      '/features',
    );
  });

  test('CTA does not generate a secondary link when it is omitted', () => {
    render(
      <CallToAction
        title="Дізнайтеся більше"
        description="Платформа ще у розробці."
        primary={{ href: '/about', label: 'Про платформу' }}
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Про платформу' }).getAttribute('href')).toBe('/about');
  });
});
