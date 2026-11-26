import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('shipping mobile code has no active diagnostic sink or new crash SDK', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  for (const file of walk(root).filter((p) => /\.(ts|tsx)$/.test(p))) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/mobileDiagnostics\.configure\s*\(/);
  }
  const pkg = JSON.parse(read('../package.json'));
  expect(pkg.dependencies).not.toHaveProperty('@sentry/react-native');
  expect(read('../app.json')).not.toContain('@sentry/react-native');
  expect(read('../docs/crash-monitoring.md')).toContain('Keep #350 open.');
});

test('existing boundaries observe only fixed render failure and response metadata', () => {
  const boundary = read('../src/shared/ui/mobile-error-boundary.tsx');
  const client = read('../src/shared/api/client.ts');
  const diagnostics = read('../src/shared/diagnostics/mobile-diagnostics.ts');
  expect(boundary).toContain("mobileDiagnostics.report({ version: 1, kind: 'render_failure' })");
  expect(boundary).toContain('componentDidCatch()');
  expect(client).toContain('const observe = mobileDiagnostics.beginApiResponseObservation()');
  expect(client).toContain('observe?.(response)');
  expect(diagnostics).toContain("response.headers.get('X-Request-ID')");
  expect(diagnostics).not.toMatch(/response\.(json|text|body|url)\b/);
  expect(diagnostics).not.toMatch(/console\.|AsyncStorage|SecureStore/);
});
