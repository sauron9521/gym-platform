import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

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
