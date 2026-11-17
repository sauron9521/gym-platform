import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const root = new URL('../src/', import.meta.url);
const css = readFileSync(new URL('dark.css', root), 'utf8');
const native = readFileSync(new URL('native.ts', root), 'utf8');

function oklchToHex(lightness, chroma, hue) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const rgb = channels.map((value) => {
    const gamma = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, gamma)) * 255);
  });
  return '#' + rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

const tokenPairs = {
  background: 'background',
  surface: 'card',
  text: 'foreground',
  muted: 'muted-foreground',
  primary: 'primary',
  border: 'border',
};

test.each(Object.entries(tokenPairs))('native %s agrees with CSS %s', (key, cssKey) => {
  const line = css.split('\n').find((entry) => entry.trim().startsWith('--' + cssKey + ': '));
  assert.ok(line, 'Missing CSS color: ' + cssKey);
  const match = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(line);
  assert.ok(match, 'Invalid CSS OKLCH color: ' + cssKey);
  const expected = oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
  const nativeMatch = new RegExp(key + ": '(#[0-9a-fA-F]{6})'").exec(native);
  assert.ok(nativeMatch, 'Missing native color: ' + key);
  assert.equal(nativeMatch[1].toLowerCase(), expected);
});
