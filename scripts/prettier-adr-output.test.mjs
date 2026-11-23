import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { test } from 'vitest';

test('emit ADR formatting diagnostic', async () => {
  const filepath = fileURLToPath(
    new URL('../docs/architecture/adr-006-shared-package-boundaries.md', import.meta.url),
  );
  const formatted = await prettier.format(readFileSync(filepath, 'utf8'), {
    ...(await prettier.resolveConfig(filepath)),
    filepath,
  });
  console.log('FORMAT_ADR_OUTPUT=' + JSON.stringify(formatted));
});
