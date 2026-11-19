import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('Athlete Web uses optimized Manrope with Latin and Ukrainian Cyrillic glyphs', () => {
  assert.match(layout, /import \{ Manrope \} from 'next\/font\/google';/);
  assert.match(layout, /subsets: \['latin', 'cyrillic', 'cyrillic-ext'\]/);
  assert.match(layout, /display: 'swap'/);
  assert.match(layout, /variable: '--font-manrope'/);
  assert.match(layout, /\$\{manrope\.variable\} min-h-screen font-sans antialiased/);
});

test('Tailwind font-sans resolves to Manrope with a platform fallback', () => {
  assert.match(css, /--font-sans: var\(--font-manrope\), ui-sans-serif, system-ui, sans-serif;/);
  assert.doesNotMatch(css, /@import\s+url\(.*fonts\./);
});
