import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('Next and Mobile ESLint configurations enforce downward-only FSD shared imports', () => {
  const next = readFileSync(new URL('../tooling/config/eslint-next.mjs', import.meta.url), 'utf8');
  const mobile = readFileSync(new URL('../apps/mobile/eslint.config.js', import.meta.url), 'utf8');

  for (const config of [next, mobile]) {
    assert.match(config, /src\/shared\/\*\*\/\*\.\{ts,tsx\}/);
    assert.match(config, /no-restricted-imports/);
    assert.match(config, /@\/features\/\*\*/);
    assert.match(config, /@\/app\/\*\*/);
  }
  assert.match(next, /@\/widgets\/\*\*/);
  assert.match(mobile, /@\/screens\/\*\*/);

  for (const [name, config, layers] of [
    ['Next', next, ['entities', 'features', 'widgets', 'pages', 'app']],
    ['Mobile', mobile, ['entities', 'features', 'widgets', 'screens', 'app']],
  ]) {
    for (const layer of layers) {
      assert.ok(config.includes(`'@/${layer}',`), `${name} must block the ${layer} barrel`);
      assert.ok(config.includes(`'@/${layer}/**',`), `${name} must block nested ${layer} imports`);
    }
  }
});
