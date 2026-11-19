import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectArgumentSignature,
  flattenCatalog,
  validateCatalogs,
} from '../scripts/catalog-contract.mjs';

test('flattens nested message catalogs into dotted keys', () => {
  assert.deepEqual(flattenCatalog({ common: { save: 'Save' } }), { 'common.save': 'Save' });
});

test('extracts ICU arguments inside plural branches and formatting tags', () => {
  assert.deepEqual(
    collectArgumentSignature('{count, plural, one {Hello {name}} other {<b>{name}</b>}}'),
    [
      ['count', 'plural'],
      ['name', 'argument'],
    ],
  );
});

test('permits different Ukrainian and English plural categories', () => {
  assert.deepEqual(
    validateCatalogs(
      { count: '{total, plural, one {One} other {Other}}' },
      { count: '{total, plural, one {Один} few {Кілька} many {Багато} other {Інше}}' },
    ).errors,
    [],
  );
});

test('reports missing keys, empty translations and malformed ICU input', () => {
  const errors = validateCatalogs(
    { missing: 'Value', empty: 'Ok', invalid: 'Hello {name' },
    { empty: ' ', invalid: 'Привіт {name}', extra: 'Додатково' },
  ).errors;
  assert.ok(errors.some((item) => item.includes('missing Ukrainian')));
  assert.ok(errors.some((item) => item.includes('missing English')));
  assert.ok(errors.some((item) => item.includes('empty translation')));
  assert.ok(errors.some((item) => item.includes('invalid English ICU')));
});

test('rejects argument-name and format-kind mismatches', () => {
  const errors = validateCatalogs(
    { name: 'Hello {name}', date: 'As of {value, date}' },
    { name: 'Привіт {username}', date: 'На {value, number}' },
  ).errors;
  assert.equal(errors.filter((item) => item.includes('ICU arguments differ')).length, 2);
});

test('rejects conflicting usages of an argument inside one message', () => {
  assert.throws(
    () => collectArgumentSignature('{value} {value, number}'),
    /conflicting format kinds/,
  );
});
