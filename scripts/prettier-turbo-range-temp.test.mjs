import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('temporary canonical formatting for Turbo range checks', async () => {
  for (const name of [
    'scripts/ci-turbo-affected-shadow.mjs',
    'scripts/ci-turbo-affected-shadow.test.mjs',
  ]) {
    const path = fileURLToPath(new URL('../' + name, import.meta.url));
    const source = readFileSync(path, 'utf8');
    const config = await prettier.resolveConfig(path);
    const formatted = await prettier.format(source, { ...config, filepath: path });
    console.log('GYM_PRETTIER_DIAG=' + JSON.stringify({ name, formatted }));
  }
});
