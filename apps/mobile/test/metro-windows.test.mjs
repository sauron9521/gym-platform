import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const workspace = readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8');
const ci = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
const smoke = readFileSync(new URL('../scripts/smoke-ios-dev.mjs', import.meta.url), 'utf8');

test('pnpm uses Expo-recommended linker for Windows native Metro compatibility', () => {
  assert.match(workspace, /^nodeLinker: hoisted$/m);
});

test('CI guards the native iOS development bundle, not just production export', () => {
  assert.match(ci, /name: Mobile iOS Dev \/ Windows Metro/);
  assert.match(ci, /node scripts\/smoke-ios-dev\.mjs/);
  assert.match(ci, /MOBILE_IOS_DEV_RESULT/);
  assert.match(smoke, /apps\\/mobile\\/index\\.bundle\\?platform=ios&dev=true&hot=true/);
  assert.match(smoke, /expo\/bin\/cli/);
});
