import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderTheme } from '../scripts/generate-theme.mjs';

describe('shared design token source', () => {
  const palette = JSON.parse(
    readFileSync(new URL('../src/palette-source.json', import.meta.url), 'utf8'),
  );
  const output = renderTheme(palette);

  it('generates the checked-in Web CSS without drift', () => {
    expect(readFileSync(new URL('../src/dark.css', import.meta.url), 'utf8')).toBe(output.css);
  });

  it('generates the checked-in React Native palette without drift', () => {
    expect(readFileSync(new URL('../src/native.ts', import.meta.url), 'utf8')).toBe(output.native);
  });

  it('refuses unbound native semantic colors', () => {
    const invalidPalette = {
      ...palette,
      native: { ...palette.native, missing: { from: 'absent', hex: '#000000' } },
    };
    expect(() => renderTheme(invalidPalette)).toThrow(/Invalid native color mapping/);
  });
});
