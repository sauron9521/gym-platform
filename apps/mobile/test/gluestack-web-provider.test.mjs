import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const provider = readFileSync(
  new URL('../src/shared/ui/gluestack/gluestack-ui-provider/index.web.tsx', import.meta.url),
  'utf8',
);

test('web Gluestack provider never renders a script tag in React 19', () => {
  assert.doesNotMatch(provider, /<script(?:\s|>)/);
  assert.doesNotMatch(provider, /dangerouslySetInnerHTML/);
  assert.match(provider, /<OverlayProvider>/);
  assert.match(provider, /<ToastProvider>/);
});

test('system theme is initialized on mount and updates when OS theme changes', () => {
  assert.match(provider, /useSafeLayoutEffect\(\(\) =>/);
  assert.match(provider, /window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(provider, /syncSystemMode\(\)/);
  assert.match(provider, /media\.addEventListener\('change', syncSystemMode\)/);
  assert.match(provider, /media\.removeEventListener\('change', syncSystemMode\)/);
  assert.match(provider, /Uniwind\.setTheme\(resolvedMode\)/);
  assert.match(provider, /script\(resolvedMode\)/);
  assert.match(provider, /if \(mode !== 'system'\)/);
});
