import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const load = (name) => readFileSync(new URL(`../assets/brand/${name}`, import.meta.url), 'utf8');
const geometry = ['M5 55 38 12H65L32 55Z', 'M37 55 67 18H85L55 55Z'];

test('OVRANTO brand assets preserve the owner-approved two-stroke silhouette', () => {
  for (const name of ['logo-light.svg', 'logo-dark.svg', 'mark.svg', 'mark-monochrome.svg']) {
    const svg = load(name);
    assert.match(svg, /<svg[^>]+viewBox="0 0 (?:286 72|90 68)"/);
    for (const stroke of geometry) assert.ok(svg.includes(stroke), `${name}: missing ${stroke}`);
    assert.equal((svg.match(/<path\s/g) ?? []).length, 2, `${name}: exactly two filled strokes`);
    assert.doesNotMatch(svg, /<(?:script|image|foreignObject)\b|(?:https?:)?\/\/[^\s"']+[^\s"']*\.((?:png|jpg|svg))/i);
  }
});

test('color assets keep teal and terracotta distinct and both wordmarks legible', () => {
  for (const name of ['logo-light.svg', 'logo-dark.svg', 'mark.svg']) {
    const svg = load(name);
    assert.match(svg, /fill="#075C55"/);
    assert.match(svg, /fill="#C76537"/);
  }
  for (const name of ['logo-light.svg', 'logo-dark.svg']) {
    const svg = load(name);
    assert.match(svg, />OVRANTO<\/text>/);
    assert.match(svg, />PERFORMANCE PLATFORM<\/text>/);
    assert.match(svg, /role="img" aria-labelledby="logo-title"/);
  }
  assert.match(load('mark-monochrome.svg'), /fill="currentColor"/);
  assert.match(load('logo-light.svg'), /fill="#292724"/);
  assert.match(load('logo-dark.svg'), /fill="#F5F0E9"/);
});
