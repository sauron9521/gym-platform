import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

function source(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Landing imports approved OVRANTO palette and Manrope instead of old Dark Performance tokens', () => {
  const stylesheet = source('src/app/globals.css');
  const layout = source('src/app/layout.tsx');
  assert.match(stylesheet, /@gym\/design-tokens\/ovranto\.css/);
  assert.doesNotMatch(stylesheet, /@gym\/design-tokens\/dark\.css/);
  assert.match(stylesheet, /--font-sans: var\(--font-manrope\)/);
  assert.match(layout, /Manrope/);
  assert.match(layout, /cyrillic-ext/);
});

test('Landing uses shared brand logo with no placeholder dumbbell art', () => {
  const header = source('src/widgets/layout/ui/site-header.tsx');
  const footer = source('src/widgets/layout/ui/site-footer.tsx');
  const icon = source('src/app/icon.svg');
  for (const shell of [header, footer]) {
    assert.match(shell, /import \{ BrandLogo \} from '@gym\/ui-web'/);
    assert.match(shell, /<BrandLogo/);
  }
  assert.match(icon, /#075C55/);
  assert.match(icon, /#C76537/);
  assert.doesNotMatch(icon, /#c8ef5a/i);
});
