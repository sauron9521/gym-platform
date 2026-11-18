import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const paths = {
  palette: new URL('../src/palette-source.json', import.meta.url),
  css: new URL('../src/dark.css', import.meta.url),
  native: new URL('../src/native.ts', import.meta.url),
  ovrantoCss: new URL('../src/ovranto.css', import.meta.url),
  ovrantoNative: new URL('../src/ovranto-native.ts', import.meta.url),
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
  const ovranto = renderOvrantoTheme(source.ovranto);
  writeFileSync(paths.ovrantoCss, ovranto.css);
  writeFileSync(paths.ovrantoNative, ovranto.native);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  generate();
}

export function renderOvrantoTheme(theme) {
  if (!theme || !theme.brand || !theme.light || !theme.dark) {
    throw new Error('Invalid OVRANTO theme source');
  }
  if (!/^\d+(\.\d+)?(rem|px)$/.test(theme.radius)) {
    throw new Error('Invalid OVRANTO radius');
  }
  const names = Object.keys(theme.light);
  if (
    !names.length ||
    names.some((key) => !(key in theme.dark)) ||
    names.length !== Object.keys(theme.dark).length
  ) {
    throw new Error('OVRANTO token keys must match');
  }
  const values = [
    theme.brand.teal,
    theme.brand.terracotta,
    ...Object.values(theme.light),
    ...Object.values(theme.dark),
  ];
  for (const value of values) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) {
      throw new Error('Invalid OVRANTO hexadecimal color');
    }
  }
  const declarations = (colors, indent) => [
    indent + '--radius: ' + theme.radius + ';',
    indent + '--brand-teal: ' + theme.brand.teal + ';',
    indent + '--brand-terracotta: ' + theme.brand.terracotta + ';',
    ...names.map((name) => indent + '--' + name + ': ' + colors[name] + ';'),
  ];
  const css = [
    '/* OVRANTO semantic tokens. Generated from palette-source.json; do not edit. */',
    ':root,',
    ':root.light,',
    ':root[data-theme="light"] {',
    '  color-scheme: light;',
    ...declarations(theme.light, '  '),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not(.light):not(.dark):not([data-theme]) {',
    '    color-scheme: dark;',
    ...declarations(theme.dark, '    '),
    '  }',
    '}',
    '',
    ':root.dark,',
    ':root[data-theme="dark"] {',
    '  color-scheme: dark;',
    ...declarations(theme.dark, '  '),
    '}',
    '',
  ].join('\n');
  const nativeKeys = names.map((key) =>
    key.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase()),
  );
  const nativeLines = (colors) =>
    names.map((name, index) => '    ' + nativeKeys[index] + ": '" + colors[name] + "',");
  const native = [
    '/** Generated OVRANTO semantic tokens from palette-source.json; do not edit. */',
    'export const ovrantoNativePalette = {',
    '  light: {',
    ...nativeLines(theme.light),
    '  },',
    '  dark: {',
    ...nativeLines(theme.dark),
    '  },',
    '  brand: {',
    "    teal: '" + theme.brand.teal + "',",
    "    terracotta: '" + theme.brand.terracotta + "',",
    '  },',
    '} as const;',
    '',
    "export type OvrantoTheme = 'light' | 'dark';",
    '',
  ].join('\n');
  return { css, native };
}
