import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const load = (locale) =>
  JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));

const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, item]) => {
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
  assert.match(uk['workouts.exerciseCount'], /\{count, plural,/);
  assert.match(en['workouts.exerciseCount'], /\{count, plural,/);
});

test('Landing namespace has localized copy for the current homepage and shared CTAs', () => {
  for (const locale of [uk, en]) {
    assert.ok(locale['landing.common.inDevelopment']);
    assert.ok(locale['landing.common.learnMore']);
    assert.ok(locale['landing.common.allApplications']);
    assert.ok(locale['landing.home.headlineLead']);
    assert.ok(locale['landing.home.headlineAccent']);
    assert.ok(locale['landing.home.description']);
  }
});

test('Landing home message keys are complete and localized in both languages', () => {
  const englishHome = Object.keys(load('en').landing.home).sort();
  const ukrainianHome = Object.keys(load('uk').landing.home).sort();
  assert.deepEqual(englishHome, ukrainianHome);
  assert.ok(englishHome.length >= 39);
  for (const key of englishHome) {
    assert.ok(en[`landing.home.${key}`].trim(), `Missing English landing.home.${key}`);
    assert.ok(uk[`landing.home.${key}`].trim(), `Missing Ukrainian landing.home.${key}`);
  }
});

test('shared API and Zod error labels are nonempty and symmetrical', () => {
  const englishErrors = load('en').errors;
  const ukrainianErrors = load('uk').errors;
  assert.deepEqual(Object.keys(englishErrors).sort(), Object.keys(ukrainianErrors).sort());
  assert.ok(Object.keys(englishErrors).length >= 19);
  for (const key of Object.keys(englishErrors)) {
    assert.ok(englishErrors[key].trim(), `Empty English error: ${key}`);
    assert.ok(ukrainianErrors[key].trim(), `Empty Ukrainian error: ${key}`);
  }
});
