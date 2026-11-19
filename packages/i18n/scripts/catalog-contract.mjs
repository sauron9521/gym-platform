import { parse } from '@formatjs/icu-messageformat-parser';

export function flattenCatalog(catalog, prefix = '') {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new TypeError('Translation catalog must be a nested object');
  }

  const result = {};
  for (const [key, value] of Object.entries(catalog)) {
    const id = prefix ? prefix + '.' + key : key;
    if (typeof value === 'string') {
      result[id] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenCatalog(value, id));
    } else {
      throw new TypeError('Invalid translation leaf: ' + id);
    }
  }
  return result;
}

const argumentKinds = {
  1: 'argument',
  2: 'number',
  3: 'date',
  4: 'time',
  5: 'select',
  6: 'plural',
};

export function collectArgumentSignature(message) {
  const found = new Map();

  function visit(nodes) {
    for (const node of nodes) {
      if (Object.hasOwn(argumentKinds, node.type)) {
        const kind =
          node.type === 6 && node.pluralType === 'ordinal'
            ? 'selectordinal'
            : argumentKinds[node.type];
        const previous = found.get(node.value);
        if (previous && previous !== kind) {
          throw new Error('Argument ' + node.value + ' has conflicting format kinds');
        }
        found.set(node.value, kind);
      }

      if (node.options) {
        for (const option of Object.values(node.options)) {
          visit(option.value);
        }
      }
      if (node.type === 8) visit(node.children);
    }
  }

  visit(parse(message, { captureLocation: false }));
  return [...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function validateCatalogs(english, ukrainian) {
  const en = flattenCatalog(english);
  const uk = flattenCatalog(ukrainian);
  const errors = [];

  for (const id of new Set([...Object.keys(en), ...Object.keys(uk)])) {
    if (!Object.hasOwn(en, id)) {
      errors.push(id + ': missing English translation');
      continue;
    }
    if (!Object.hasOwn(uk, id)) {
      errors.push(id + ': missing Ukrainian translation');
      continue;
    }

    if (!en[id].trim() || !uk[id].trim()) {
      errors.push(id + ': empty translation');
      continue;
    }

    let enSignature;
    let ukSignature;
    try {
      enSignature = collectArgumentSignature(en[id]);
    } catch (error) {
      errors.push(id + ': invalid English ICU message: ' + error.message);
    }
    try {
      ukSignature = collectArgumentSignature(uk[id]);
    } catch (error) {
      errors.push(id + ': invalid Ukrainian ICU message: ' + error.message);
    }

    if (enSignature && ukSignature && JSON.stringify(enSignature) !== JSON.stringify(ukSignature)) {
      errors.push(
        id +
          ': ICU arguments differ: en ' +
          JSON.stringify(enSignature) +
          ' vs uk ' +
          JSON.stringify(ukSignature),
      );
    }
  }

  return { count: Object.keys(en).length, errors };
}
