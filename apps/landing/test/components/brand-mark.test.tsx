import { BrandLogo } from '@gym/ui-web';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);

test('landing shares the official OVRANTO symbol, accessible wordmark and fixed brand colors', () => {
  render(
    <div data-testid="brand">
      <BrandLogo />
    </div>,
  );
  const root = screen.getByTestId('brand');
  const logo = root.querySelector('[data-slot="brand-logo"]');
  const mark = root.querySelector('svg[data-slot="brand-mark"]');
  expect(logo?.textContent).toContain('OVRANTO');
  expect(mark?.getAttribute('viewBox')).toBe('0 0 90 68');
  expect(mark?.getAttribute('aria-hidden')).toBe('true');
  const fills = [...(mark?.querySelectorAll('path') ?? [])].map((path) =>
    path.getAttribute('fill'),
  );
  expect(fills).toEqual(['#075C55', '#C76537']);
});
