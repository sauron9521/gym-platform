import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('presentation-only landing does not carry unused form and API client dependencies', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of [
    '@hookform/resolvers',
    '@tanstack/react-query',
    'react-hook-form',
    'zod',
    '@radix-ui/react-slot',
    'class-variance-authority',
  ]) {
    assert.equal(pkg.dependencies[name], undefined, name + ' should not be installed here');
  }
});
