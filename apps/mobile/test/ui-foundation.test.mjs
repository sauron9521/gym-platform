import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('Babel and TypeScript aliases both point to mobile src', () => {
  const babel = read('../babel.config.js');
  const tsconfig = JSON.parse(read('../tsconfig.json'));
  assert.match(babel, /'@': '\.\/src'/);
  assert.deepEqual(tsconfig.compilerOptions.paths['@/*'], ['./src/*']);
});
