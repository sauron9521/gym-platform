import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'vitest';
import { nativePalette } from '@gym/design-tokens/native';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('UniWind is configured only for the mobile Expo app', () => {
  const metro = read('../metro.config.js');
  const css = read('../global.css');
  assert.match(metro, /withUniwindConfig/);
  assert.match(css, /@layer theme \{/);
  assert.match(css, /\.light \{/);
  assert.match(css, /\.dark \{/);
});

test('Gluestack root provider preserves authenticated route guards', () => {
  const layout = read('../src/app/_layout.tsx');
  assert.match(layout, /<GluestackUIProvider/);
  assert.match(layout, /<Stack\.Protected guard=\{Boolean\(account\)\}>/);
  assert.match(layout, /<Stack\.Protected guard=\{!account\}>/);
});

test('Expo uses its default Babel setup and TypeScript resolves aliases to src', () => {
  const tsconfig = JSON.parse(read('../tsconfig.json'));
  assert.equal(existsSync(new URL('../babel.config.js', import.meta.url)), false);
  assert.deepEqual(tsconfig.compilerOptions.paths['@/*'], ['./src/*']);
});

test('Mobile uses the workspace Dark Performance native palette', () => {
  const theme = read('../src/shared/config/theme.ts');
  const css = read('../global.css');
  const packageJson = JSON.parse(read('../package.json'));
  assert.match(theme, /@gym\/design-tokens\/native/);
  assert.equal(packageJson.dependencies['@gym/design-tokens'], 'workspace:*');
  const dark = css.split('  .dark {')[1]?.split('  }')[0];
  assert.ok(dark);
  for (const token of [
    '--primary: 182 234 58;',
    '--background: 10 14 19;',
    '--foreground: 239 242 246;',
    '--card: 20 25 31;',
  ]) {
    assert.ok(dark.includes(token), token);
  }
});

test('native palette matches UniWind dark color channels and root theme', () => {
  const css = read('../global.css');
  const layout = read('../src/app/_layout.tsx');
  const dark = css.split('  .dark {')[1]?.split('  }')[0];
  assert.ok(dark, 'UniWind dark theme must exist');

  for (const [paletteKey, cssKey] of [
    ['background', 'background'],
    ['surface', 'card'],
    ['text', 'foreground'],
    ['muted', 'muted-foreground'],
    ['primary', 'primary'],
    ['border', 'border'],
  ]) {
    const declaration = dark
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith(`--${cssKey}: `));
    assert.ok(declaration, `Missing dark token: ${cssKey}`);
    const channels = declaration
      .replace(`--${cssKey}:`, '')
      .replace(';', '')
      .trim()
      .split(/\s+/)
      .map(Number);
    assert.equal(channels.length, 3, `Invalid RGB channels: ${cssKey}`);
    assert.ok(
      channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255),
    );
    const hex = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    assert.equal(nativePalette[paletteKey], hex, `Mismatch for dark color: ${paletteKey}`);
  }

  assert.ok(layout.includes('<GluestackUIProvider mode="dark">'));
  assert.ok(layout.includes('<StatusBar style="light" />'));
});
