import { readFileSync } from 'node:fs';
import { parse } from '@formatjs/icu-messageformat-parser';

const load = (locale) => JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
const flatten = (value, prefix = '') => Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
  const id = prefix ? `${prefix}.${key}` : key;
  return typeof item === 'string' ? [[id, item]] : Object.entries(flatten(item, id));
}));

const en = flatten(load('en'));
const uk = flatten(load('uk'));
const errors = [];
const enKeys = Object.keys(en).sort();
const ukKeys = Object.keys(uk).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(ukKeys)) errors.push('en/uk must have identical keys');

function collectParameters(message) {
  const found = new Map();
  const visit = (nodes) => {
    for (const node of nodes) {
      if ([1, 2, 3, 4, 5, 6].includes(node.type)) {
        const kind = node.type === 5 ? 'select' : node.type === 6 ? 'plural' : 'argument';
        const old = found.get(node.value);
        if (old && old !== kind) throw new Error(`Argument ${node.value} has mixed kinds`);
        found.set(node.value, kind);
      }
      if (node.options) for (const option of Object.values(node.options)) visit(option.value);
      if (node.type === 8) visit(node.children);
    }
  };
  visit(parse(message, { captureLocation: false }));
  return [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

for (const key of new Set([...enKeys, ...ukKeys])) {
  if (!en[key] || !uk[key]) { errors.push(`${key}: missing/empty translation`); continue; }
  try {
    const a = collectParameters(en[key]);
    const b = collectParameters(uk[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`${key}: ICU arguments differ: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  } catch (error) { errors.push(`${key}: ${error.message}`); }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`i18n: ${enKeys.length} translation keys validated for uk/en`);
