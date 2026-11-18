import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { BrandLogo } from '@gym/ui-web';

afterEach(cleanup);

describe('OVRANTO shared BrandLogo', () => {
  test('uses text for the brand and a decorative SVG rather than a heading', () => {
    const { container } = render(
      <a href="/" aria-label="OVRANTO — головна">
        <BrandLogo />
      </a>,
    );

    expect(screen.getByRole('link', { name: 'OVRANTO — головна' })).toBeTruthy();
    expect(screen.getByText('OVRANTO').tagName).toBe('SPAN');
    expect(screen.getByText('PERFORMANCE PLATFORM').tagName).toBe('SPAN');
    expect(container.querySelector('h1')).toBeNull();

    const mark = container.querySelector('[data-slot="brand-mark"]');
    expect(mark?.tagName.toLowerCase()).toBe('svg');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(mark?.getAttribute('focusable')).toBe('false');
  });

  test('matches the canonical mark.svg geometry and palette in both themes', () => {
    const master = readFileSync(
      new URL('../../../../assets/brand/mark.svg', import.meta.url),
      'utf8',
    );
    const expected = [...master.matchAll(/<path d="([^"]+)" fill="([^"]+)" \/>/g)].map(
      ([, d, fill]) => ({ d, fill }),
    );

    for (const theme of ['light', 'dark']) {
      const { container, unmount } = render(
        <div className={theme}>
          <BrandLogo />
        </div>,
      );

      const mark = container.querySelector('[data-slot="brand-mark"]');
      const actual = [...(mark?.querySelectorAll('path') ?? [])].map((path) => ({
        d: path.getAttribute('d'),
        fill: path.getAttribute('fill'),
      }));

      expect(actual).toEqual(expected);
      expect(mark?.getAttribute('viewBox')).toBe('0 0 90 68');
      expect(container.querySelector('[data-slot="brand-logo"]')?.className).toContain(
        'text-foreground',
      );
      expect(screen.getByText('PERFORMANCE PLATFORM').className).toContain(
        'text-muted-foreground',
      );
      unmount();
    }
  });

  test('supports a compact wordmark without tagline', () => {
    render(<BrandLogo showTagline={false} />);
    expect(screen.getByText('OVRANTO')).toBeTruthy();
    expect(screen.queryByText('PERFORMANCE PLATFORM')).toBeNull();
  });
});
