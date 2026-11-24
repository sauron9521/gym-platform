import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('temporary canonical Prettier formatting for syntax-parity files', async () => {
  for (const name of [
    'scripts/dependency-cruiser-syntax-parity.test.mjs',
    'docs/dependency-cruiser-pilot.md',
  ]) {
    const path = fileURLToPath(new URL('../' + name, import.meta.url));
    const source = readFileSync(path, 'utf8');
    const config = await prettier.resolveConfig(path);
    const formatted = await prettier.format(source, { ...config, filepath: path });
    console.log('GYM_PRETTIER_DIAG=' + JSON.stringify({ name, formatted }));
  }
});
