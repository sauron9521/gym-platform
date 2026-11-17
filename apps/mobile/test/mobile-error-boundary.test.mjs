import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('native render failures use a guarded fallback inside existing providers', () => {
  const boundary = readFileSync(
    new URL('../src/shared/ui/mobile-error-boundary.tsx', import.meta.url),
    'utf8',
  );
  const root = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');

  expect(boundary).toContain('getDerivedStateFromError');
  expect(boundary).toContain('mobile-error-retry');
  expect(boundary).not.toContain('console.error');
  expect(boundary).not.toContain('error.message');
  expect(root).toContain('<LocaleProvider>');
  expect(root).toContain('<MobileQueryProvider>');
  expect(root).toContain('<MobileErrorBoundary>');
});
