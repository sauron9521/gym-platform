import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { MobileTokenSession } from '../src/features/auth/model/mobile-token-session.ts';

const pair = (suffix, expiresIn = 120) => ({
  accessToken: 'access-' + suffix,
  refreshToken: 'refresh-' + suffix,
  expiresIn,
});

function makeStore(initial = null) {
  let saved = initial;
  const writes = [];
  return {
    storage: {
      read: async () => saved,
      write: async (token) => {
        writes.push(token);
        saved = token;
      },
      remove: async () => {
        saved = null;
      },
    },
    get saved() {
      return saved;
    },
    writes,
  };
}

test('only refresh credentials are persisted; access token stays in memory', async () => {
  const store = makeStore();
  const session = new MobileTokenSession(
    store.storage,
    async () => pair('next'),
    async () => undefined,
    () => undefined,
  );
  assert.equal(await session.accept(pair('first')), true);
  assert.equal(store.saved, 'refresh-first');
  assert.deepEqual(store.writes, ['refresh-first']);
  assert.equal(await session.getAccessToken(), 'access-first');
});

test('restore rotates stored refresh once even with concurrent StrictMode bootstraps', async () => {
  const store = makeStore('refresh-old');
  const calls = [];
  const session = new MobileTokenSession(
    store.storage,
    async (token) => {
      calls.push(token);
      return pair('next');
    },
    async () => undefined,
    () => undefined,
  );
  assert.deepEqual(await Promise.all([session.restore(), session.restore()]), [true, true]);
  assert.deepEqual(calls, ['refresh-old']);
  assert.equal(store.saved, 'refresh-next');
  assert.equal(await session.getAccessToken(), 'access-next');
});

test('expiring access token coalesces parallel refresh requests', async () => {
  const store = makeStore();
  let now = 0;
  let calls = 0;
  let finish;
  const session = new MobileTokenSession(
    store.storage,
    async (token) => {
      calls++;
      assert.equal(token, 'refresh-old');
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    async () => undefined,
    () => undefined,
    () => now,
  );
  await session.accept(pair('old', 60));
  now = 45_000;
  const first = session.getAccessToken();
  const second = session.getAccessToken();
  assert.equal(calls, 1);
  finish(pair('new'));
  assert.deepEqual(await Promise.all([first, second]), ['access-new', 'access-new']);
  assert.equal(calls, 1);
  assert.equal(store.saved, 'refresh-new');
  assert.deepEqual(store.writes, ['refresh-old', 'refresh-new']);
});

test('invalid/reused refresh token erases session and reports invalidation', async () => {
  const store = makeStore('refresh-old');
  let invalidations = 0;
  const session = new MobileTokenSession(
    store.storage,
    async () => null,
    async () => undefined,
    () => invalidations++,
  );
  assert.equal(await session.restore(), false);
  assert.equal(store.saved, null);
  assert.equal(await session.getAccessToken(), null);
  assert.equal(invalidations, 1);
});

test('network failure preserves stored credential without automatic reuse', async () => {
  const store = makeStore('refresh-old');
  const session = new MobileTokenSession(
    store.storage,
    async () => {
      throw new Error('offline');
    },
    async () => undefined,
    () => undefined,
  );
  await assert.rejects(session.restore(), /offline/);
  assert.equal(store.saved, 'refresh-old');
});

test('logout while a refresh is pending never resurrects the session', async () => {
  const store = makeStore();
  let finish;
  let now = 0;
  const revoked = [];
  const session = new MobileTokenSession(
    store.storage,
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    async (token) => revoked.push(token),
    () => undefined,
    () => now,
  );
  await session.accept(pair('old', 60));
  now = 45_000;
  const pending = session.getAccessToken();
  await session.clear();
  finish(pair('new'));
  assert.equal(await pending, null);
  assert.equal(store.saved, null);
  assert.deepEqual(revoked, ['refresh-new']);
});

test('failed SecureStore write invalidates and revokes the rotated successor', async () => {
  const store = makeStore();
  const write = store.storage.write;
  store.storage.write = async (token) => {
    if (token === 'refresh-new') throw new Error('secure storage locked');
    return write(token);
  };
  let now = 0;
  const revoked = [];
  let invalidations = 0;
  const session = new MobileTokenSession(
    store.storage,
    async () => pair('new'),
    async (token) => revoked.push(token),
    () => invalidations++,
    () => now,
  );
  await session.accept(pair('old', 60));
  now = 45_000;
  assert.equal(await session.getAccessToken(), null);
  assert.equal(store.saved, null);
  assert.deepEqual(revoked, ['refresh-new']);
  assert.equal(invalidations, 1);
});

test('native secure storage and gated profile bootstrap are wired without web persistence', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const auth = read('../src/features/auth/model/auth-context.tsx');
  const layout = read('../src/app/_layout.tsx');
  const native = read('../src/features/auth/model/refresh-token-store.ts');
  const web = read('../src/features/auth/model/refresh-token-store.web.ts');
  const config = JSON.parse(read('../app.json'));

  assert.ok(auth.includes('await session.restore()'));
  assert.ok(auth.includes("api.GET('/users/me')"));
  assert.ok(auth.includes("POST('/auth/token/refresh'"));
  assert.ok(auth.includes("POST('/auth/token/revoke'"));
  assert.ok(auth.includes('session.getAccessToken()'));
  assert.ok(auth.includes('queryClient.clear()'));
  assert.ok(layout.includes('restoring ?'));
  assert.ok(layout.includes('loadingOverlay'));
  assert.ok(native.includes('SecureStore.getItemAsync'));
  assert.ok(native.includes('SecureStore.setItemAsync'));
  assert.ok(native.includes('WHEN_UNLOCKED_THIS_DEVICE_ONLY'));
  assert.doesNotMatch(web, /localStorage|sessionStorage|AsyncStorage/);
  assert.ok(config.expo.plugins.includes('expo-secure-store'));
});

test('manual profile retry reads cached token without rotating refresh', async () => {
  const store = makeStore('refresh-old');
  let now = 0;
  let refreshCalls = 0;
  const session = new MobileTokenSession(
    store.storage,
    async () => {
      refreshCalls += 1;
      return pair('next', 60);
    },
    async () => undefined,
    () => undefined,
    () => now,
  );

  assert.equal(session.canRevalidate(), false);
  assert.equal(session.getRevalidationToken(), null);
  assert.equal(await session.restore(), true);
  assert.equal(refreshCalls, 1);
  assert.equal(session.canRevalidate(), true);
  assert.equal(session.getRevalidationToken(), 'access-next');
  assert.equal(refreshCalls, 1);

  now = 31_000;
  assert.equal(session.canRevalidate(), false);
  assert.equal(session.getRevalidationToken(), null);
  assert.equal(refreshCalls, 1);
  await session.clear();
  assert.equal(session.getRevalidationToken(), null);
});

test('transient profile failure exposes a safe retry without replaying one-time refresh', () => {
  const auth = readFileSync(
    new URL('../src/features/auth/model/auth-context.tsx', import.meta.url),
    'utf8',
  );
  const screen = readFileSync(
    new URL('../src/screens/sign-in/ui/sign-in-screen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(auth, /session\.canRevalidate\(\)/);
  assert.match(auth, /retryVerification/);
  assert.ok(auth.includes('createMobileApi(baseUrl, () => session.getRevalidationToken())'));
  assert.ok(auth.includes('response.response.status === 401 || response.response.status === 403'));
  assert.ok(auth.includes('result.response.status === 401 || result.response.status === 403'));
  const retry = auth.split('const retryVerification =')[1]?.split('const signIn =')[0];
  assert.ok(retry, 'Verification callback exists');
  assert.ok(retry.includes('getVerificationApi()'));
  assert.ok(!retry.includes('getApi()'), 'Verification must not rotate tokens');
  assert.match(screen, /Відновити сесію/);
});
