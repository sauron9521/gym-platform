import { readFileSync } from 'node:fs';

import { validateCatalogs } from './catalog-contract.mjs';

const load = (locale) =>
  JSON.parse(readFileSync(new URL('../src/messages/' + locale + '.json', import.meta.url), 'utf8'));

const { count, errors } = validateCatalogs(load('en'), load('uk'));

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('i18n: ' + count + ' translation keys validated for uk/en');
}
