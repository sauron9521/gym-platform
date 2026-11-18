import { readFileSync } from 'node:fs';

import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { BrandLogo } from '@gym/ui-web';

afterEach(cleanup);

test('BrandLogo renders accessible HTML text, never a heading', () => {
  const { container } = render(<BrandLogo />);

  expect(screen.getByText('OVRANTO').tagName).toBe('SPAN');
  expect(screen.getByText('PERFORMANCE PLATFORM').tagName).toBe('SPAN');
  expect(container.querySelector('h1')).toBeNull();
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('svg')?.getAttribute('focusable')).toBe('false');
});

test('BrandLogo preserves master SVG shapes and brand colors', () => {
  const source = new URL('../../../../assets/brand/mark.svg', import.meta.url);
  const master = readFileSync(source, 'utf8');
  const { container } = render(<BrandLogo />);
  const strokes = container.querySelectorAll('svg path');

  expect(strokes).toHaveLength(2);
  for (const stroke of strokes) {
    const geometry = `d="${stroke.getAttribute('d')}" fill="${stroke.getAttribute('fill')}"`;
    expect(master).toContain(geometry);
  }
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 90 68');
});

test('BrandLogo has semantic theme classes and can hide the tagline', () => {
  const { container } = render(<BrandLogo showTagline={false} />);

  expect(screen.getByText('OVRANTO')).toBeTruthy();
  expect(screen.queryByText('PERFORMANCE PLATFORM')).toBeNull();

  const logo = container.querySelector('[data-slot="brand-logo"]');
  expect(logo?.className).toContain('text-foreground');
});
