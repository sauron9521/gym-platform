import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';

test('features page uses functional internal routes instead of placeholder template', () => {
  const source = readFileSync(new URL('../src/app/features/page.tsx', import.meta.url), 'utf8');
  expect(source).toContain('FeatureCard');
  expect(source).toContain('CallToAction');
  expect(source).not.toContain('IntroPage');
});
