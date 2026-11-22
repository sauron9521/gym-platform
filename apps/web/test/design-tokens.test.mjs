import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const webCss = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const landingCss = readFileSync(
  new URL('../../landing/src/app/globals.css', import.meta.url),
  'utf8',
);
const webPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Web and Landing share the approved OVRANTO design tokens', () => {
  for (const css of [webCss, landingCss]) {
    assert.match(css, /@import '@gym\/design-tokens\/ovranto.css';/);
    assert.doesNotMatch(css, /@import '@gym\/design-tokens\/dark.css';/);
    assert.doesNotMatch(css, /--(?:background|primary|card):\s*oklch\(/);
  }
  assert.equal(webPackage.dependencies['@gym/design-tokens'], 'workspace:*');
});
