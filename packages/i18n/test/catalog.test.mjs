import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const load = (locale) => JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return typeof item === 'string' ? [[path, item]] : flatten(item, path);
});

const uk = Object.fromEntries(flatten(load('uk')));
const en = Object.fromEntries(flatten(load('en')));

test('Ukrainian and English catalogs have the same non-empty keys', () => {
  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(uk)) {
    assert.ok(value.trim(), `Empty uk:${key}`);
    assert.ok(en[key].trim(), `Empty en:${key}`);
  }
});

test('Pluralization arguments exist in both workout messages', () => {
  assert.match(uk['workouts.exerciseCount'], /\\{count, plural,/);
  assert.match(en['workouts.exerciseCount'], /\\{count, plural,/);
});
