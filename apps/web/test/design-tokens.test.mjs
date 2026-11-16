import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const webCss = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const landingCss = readFileSync(
  new URL('../../landing/src/app/globals.css', import.meta.url),
  'utf8',
);
const webPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Web and Landing consume the one canonical Dark Performance palette', () => {
  assert.match(webCss, /@import '@gym\/design-tokens\/dark.css';/);
  assert.match(landingCss, /@import '@gym\/design-tokens\/dark.css';/);
  assert.equal(webPackage.dependencies['@gym/design-tokens'], 'workspace:*');
  assert.doesNotMatch(webCss, /--(?:background|primary|card):\s*oklch\(/);
});
