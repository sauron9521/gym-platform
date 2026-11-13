import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

test('Next.js app router entrypoints exist', () => {
  assert.ok(existsSync(new URL('../src/app/layout.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/register/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/verify-email/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../src/app/verify-email/resend/page.tsx', import.meta.url)));
});

test('shadcn/ui configuration exists', () => {
  assert.ok(existsSync(new URL('../components.json', import.meta.url)));
});
