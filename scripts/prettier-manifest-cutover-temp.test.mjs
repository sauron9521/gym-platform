import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('temporary canonical formatting for manifest guard', async () => {
  const name = 'scripts/check-workspace-boundaries.mjs';
  const file = fileURLToPath(new URL('../' + name, import.meta.url));
  const source = readFileSync(file, 'utf8');
  const config = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, { ...config, filepath: file });
  console.log('GYM_PRETTIER_DIAG=' + JSON.stringify({ name, formatted }));
});
