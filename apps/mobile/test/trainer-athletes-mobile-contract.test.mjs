import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('trainer-only native route reads scoped relations and redacts historical email', () => {
  const model = read('../src/features/trainer-athletes/model/trainer-athletes-query.ts');
  const screen = read('../src/screens/trainer-athletes/ui/trainer-athletes-screen.tsx');
  const layout = read('../src/app/_layout.tsx');
  expect(model).toContain("api.GET('/trainer-athletes'");
  expect(model).toContain("enabled: account?.role === 'TRAINER'");
  expect(screen).not.toContain('item.athlete.email');
  expect(layout).toContain("account?.role === 'TRAINER'");
});
