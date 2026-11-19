import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { renderOvrantoTheme } from '../scripts/generate-theme.mjs';

const source = JSON.parse(
  readFileSync(new URL('../src/palette-source.json', import.meta.url), 'utf8'),
);
const theme = source.ovranto;

function luminance(value: string): number {
  const hex =
    value.length === 4
      ? '#' + [...value.slice(1)].map((letter) => letter + letter).join('')
      : value;
  const channels = hex.slice(1).match(/.{2}/g);
  if (!channels) throw new Error('Invalid color');
  const rgb = channels.map((channel) => parseInt(channel, 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('OVRANTO semantic Light/Dark palette', () => {
  it('regenerates CSS and native colors without drift', () => {
    const output = renderOvrantoTheme(theme);
    const css = readFileSync(new URL('../src/ovranto.css', import.meta.url), 'utf8');
    const native = readFileSync(new URL('../src/ovranto-native.ts', import.meta.url), 'utf8');
    expect(css).toBe(output.css);
    expect(native).toBe(output.native);
  });

  it('offers system default and explicit theme overrides', () => {
    const css = renderOvrantoTheme(theme).css;
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it('contains the approved dual-color brand and four full-row set states', () => {
    expect(theme.brand).toEqual({ teal: '#075c55', terracotta: '#c76537' });
    for (const variant of ['light', 'dark']) {
      expect(theme[variant]['set-active-background']).toBe('#075c55');
      for (const state of ['complete', 'active', 'pending', 'error']) {
        expect(theme[variant]['set-' + state + '-background']).toBeDefined();
        expect(theme[variant]['set-' + state + '-foreground']).toBeDefined();
      }
    }
  });

  it('has at least WCAG AA 4.5:1 contrast for essential text pairs', () => {
    const pairs = [
      ['foreground', 'background'],
      ['card-foreground', 'card'],
      ['primary-foreground', 'primary'],
      ['secondary-foreground', 'secondary'],
      ['muted-foreground', 'muted'],
      ['accent-foreground', 'accent'],
      ['destructive-foreground', 'destructive'],
      ['success-foreground', 'success'],
      ['warning-foreground', 'warning'],
      ['set-complete-foreground', 'set-complete-background'],
      ['set-active-foreground', 'set-active-background'],
      ['set-pending-foreground', 'set-pending-background'],
      ['set-error-foreground', 'set-error-background'],
    ];
    for (const variant of ['light', 'dark']) {
      for (const [foreground, background] of pairs) {
        const ratio = contrast(theme[variant][foreground], theme[variant][background]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('refuses a missing token or malformed color', () => {
    expect(() => renderOvrantoTheme({ ...theme, dark: {} })).toThrow(/must match/);
    const invalid = { ...theme, light: { ...theme.light, primary: 'invalid' } };
    expect(() => renderOvrantoTheme(invalid)).toThrow(/hexadecimal/);
  });
});
