import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { BrandMark } from '../../src/shared/ui/brand-mark';

afterEach(cleanup);

test('brand mark stays decorative and uses scalable vector geometry', () => {
  render(
    <div data-testid="brand">
      <BrandMark />
    </div>,
  );
  const svg = screen.getByTestId('brand').querySelector('svg');
  expect(svg?.getAttribute('viewBox')).toBe('0 0 48 48');
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
});
