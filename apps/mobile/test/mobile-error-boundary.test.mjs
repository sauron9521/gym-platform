import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('render failures show a recoverable native fallback without leaking data', () => {
  const source = read('../src/shared/ui/mobile-error-boundary.tsx');
  const root = read('../src/app/_layout.tsx');
  expect(source).toContain('getDerivedStateFromError');
  expect(source).toContain('Відновити екран');
  expect(root).toContain('<MobileErrorBoundary>');
  expect(source).not.toContain('console.error(error)');
});
