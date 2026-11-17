import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const paths = {
  palette: new URL('../src/palette-source.json', import.meta.url),
  css: new URL('../src/dark.css', import.meta.url),
  native: new URL('../src/native.ts', import.meta.url),
};

export function renderTheme(source) {
  if (!source || !source.css || !source.native) {
    throw new Error('Invalid palette source');
  }
  const css = [
    '/* Gym Platform Dark Performance: canonical semantic color tokens. */',
    ':root {',
    '  color-scheme: dark;',
    ...Object.entries(source.css).map(([key, value]) => `  --${key}: ${value};`),
    '}',
    '',
  ].join('\n');

  for (const [name, mapping] of Object.entries(source.native)) {
    if (!(mapping.from in source.css) || !/^#[0-9a-f]{6}$/i.test(mapping.hex)) {
      throw new Error(`Invalid native color mapping: ${name}`);
    }
  }
  const native = [
    '/**',
    ' * sRGB equivalents of the canonical Dark Performance OKLCH CSS palette.',
    ' * Generated from palette-source.json; edit the source and run pnpm tokens:generate.',
    ' */',
    'export const nativePalette = {',
    ...Object.entries(source.native).map(([key, value]) => `  ${key}: '${value.hex}',`),
    '} as const;',
    '',
  ].join('\n');

  return { css, native };
}

export function generate() {
  const source = JSON.parse(readFileSync(paths.palette, 'utf8'));
  const generated = renderTheme(source);
  writeFileSync(paths.css, generated.css);
  writeFileSync(paths.native, generated.native);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  generate();
}
