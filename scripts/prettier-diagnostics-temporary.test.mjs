import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('temporary formatting diagnostics for named import pilot', async () => {
  for (const name of [
    'scripts/dependency-cruiser-named-imports.mjs',
    'scripts/dependency-cruiser-named-imports.test.mjs',
  ]) {
    const path = fileURLToPath(new URL('../' + name, import.meta.url));
    const content = readFileSync(path, 'utf8');
    const options = await prettier.resolveConfig(path);
    const formatted = await prettier.format(content, { ...options, filepath: path });
    console.log('GYM_PRETTIER_DIAG=' + JSON.stringify({ name, formatted }));
  }
});
