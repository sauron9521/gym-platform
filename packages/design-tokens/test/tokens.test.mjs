import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/dark.css', import.meta.url), 'utf8');

test('dark theme contains the canonical semantic tokens used by landing', () => {
  assert.match(css, /:root\s*\{/);
  assert.match(css, /color-scheme: dark;/);
  for (const token of [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'destructive',
    'border',
    'input',
    'ring',
    'radius',
  ]) {
    const declaration = new RegExp('--' + token + ':\\s*[^;]+;');
    assert.match(css, declaration, 'Missing ' + token);
  }
});
