import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const exports = readFileSync(
  new URL('../../../packages/ui-web/src/index.ts', import.meta.url),
  'utf8',
);
const login = readFileSync(
  new URL('../src/features/auth/ui/sign-in-form.tsx', import.meta.url),
  'utf8',
);

test('shared UI exposes primitive components without importing app code', () => {
  assert.match(exports, /export \{ Input \} from '.\/input';/);
  assert.match(exports, /export \{ Card, CardHeader, CardTitle/);
  assert.doesNotMatch(exports, /@\/|next\/navigation|@gym\/api-client/);
});

test('login uses the shared Input while preserving form validation and session gate', () => {
  assert.match(login, /import \{ Input \} from '@\/shared\/ui\/input'/);
  assert.match(login, /<Input/);
  assert.match(login, /\.\.\.register\('email'/);
  assert.match(login, /\.\.\.register\('password'/);
  assert.match(login, /zodResolver\(loginSchema\)/);
  assert.match(login, /classifySessionCheck/);
});
