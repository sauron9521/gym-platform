import { createHash } from 'node:crypto';

import { AuthenticationStorage, InMemoryMfaStore, MfaService } from '@nestjs/authentication';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '../env.validation.js';
import { createMfaEncryptionOptions } from '../mfa-keyring.config.js';

const fixture = (name: string) => createHash('sha256').update(name).digest('base64url');
const old = fixture('old test fixture');
const next = fixture('new test fixture');
const jwt = 'independent test fixture';
const env = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/gym_test',
  JWT_SECRET: jwt,
  JWT_ISSUER: 'http://localhost:3000',
  APP_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
};

describe('MFA keyring configuration', () => {
  it('keeps absent and explicitly empty keyrings unconfigured', () => {
    expect(validateEnv(env).MFA_ENCRYPTION_KEYS).toBeUndefined();
    expect(validateEnv({ ...env, MFA_ENCRYPTION_KEYS: '' }).MFA_ENCRYPTION_KEYS).toBeUndefined();
  });

  it('preserves order and returns binary keys without plaintext migration', () => {
    const raw = next + ', ' + old;
    expect(validateEnv({ ...env, MFA_ENCRYPTION_KEYS: raw }).MFA_ENCRYPTION_KEYS).toBe(raw);
    expect(createMfaEncryptionOptions(raw, jwt)).toEqual({
      keys: [Buffer.from(next, 'base64url'), Buffer.from(old, 'base64url')],
      migratePlaintext: false,
    });
  });

  it.each([
    ' ',
    'short',
    'a'.repeat(43),
    next + '=',
    next.slice(0, -1) + 'B',
    next + ',',
    next + ',' + next,
    Array.from({ length: 6 }, (_, i) => fixture('fixture-' + i)).join(','),
  ])('rejects invalid keyring shape without exposing it', (raw) => {
    expect(() => validateEnv({ ...env, MFA_ENCRYPTION_KEYS: raw })).toThrow('MFA_ENCRYPTION_KEYS');
    if (raw.length > 8) {
      try {
        validateEnv({ ...env, MFA_ENCRYPTION_KEYS: raw });
      } catch (error) {
        expect(String(error)).not.toContain(raw);
      }
    }
  });

  it.each([next, Buffer.from(next, 'base64url').toString('base64')])(
    'rejects reused JWT key material',
    (secret) => {
      expect(() => validateEnv({ ...env, JWT_SECRET: secret, MFA_ENCRYPTION_KEYS: next })).toThrow(
        'MFA_ENCRYPTION_KEYS',
      );
    },
  );

  it('rejects reuse of a raw 32-byte JWT value', () => {
    const secret = 'independent test fixture'.padEnd(32, 'x');
    const key = Buffer.from(secret).toString('base64url');
    expect(() => createMfaEncryptionOptions(key, secret)).toThrow();
  });
});

describe('library AES-256-GCM key rotation', () => {
  function setup() {
    const store = new InMemoryMfaStore();
    const storage = new AuthenticationStorage();
    storage.registerSource({ mfa: store });
    const service = (raw: string) =>
      new MfaService(storage, { mfa: { encryption: createMfaEncryptionOptions(raw, jwt) } });
    return { store, service };
  }

  it('reads old ciphertext and writes with the promoted first key', async () => {
    const { store, service } = setup();
    await service(old).enroll('owner', 'test-owner');
    const previous = (await store.getTotp('owner'))!;
    expect(await service(next).reencrypt('owner')).toBe(false);
    expect(await store.getTotp('owner')).toEqual(previous);

    // Distribute the next key as a reader before promoting it to writer.
    expect(await service(old + ',' + next).reencrypt('owner')).toBe(false);
    expect(await service(next + ',' + old).reencrypt('owner')).toBe(true);
    const rotated = (await store.getTotp('owner'))!;
    expect(rotated.secret).not.toBe(previous.secret);
    expect(rotated.secret.split('.')[1]).not.toBe(previous.secret.split('.')[1]);
    expect(await service(old).reencrypt('owner')).toBe(false);
    expect(await service(next).reencrypt('owner')).toBe(false);
    // A replica that still writes with the old key can reverse rotation.
    expect(await service(old + ',' + next).reencrypt('owner')).toBe(true);
  });

  it('fails closed for plaintext and ciphertext copied to another owner', async () => {
    const { store, service } = setup();
    await store.saveTotp('plaintext', { secret: 'synthetic-plaintext', confirmed: true });
    expect(await service(next + ',' + old).reencrypt('plaintext')).toBe(false);
    await service(old).enroll('owner', 'test-owner');
    const original = (await store.getTotp('owner'))!;
    await store.saveTotp('other', original);
    expect(await service(next + ',' + old).reencrypt('other')).toBe(false);
    expect(await store.getTotp('other')).toEqual(original);
  });

  it('does not pretend reencrypt also rotates a staged replacement secret', async () => {
    const { store, service } = setup();
    await service(old).enroll('owner', 'test-owner');
    const original = (await store.getTotp('owner'))!;
    await store.saveTotp('owner', { ...original, confirmed: true });
    await service(old).enroll('owner', 'test-owner', { replace: true });
    const staged = (await store.getTotp('owner'))!;
    expect(staged.pendingSecret).toBeDefined();
    expect(await service(next + ',' + old).reencrypt('owner')).toBe(true);
    const rotated = (await store.getTotp('owner'))!;
    expect(rotated.pendingSecret).toBe(staged.pendingSecret);
    expect(rotated.secret.split('.')[1]).not.toBe(staged.pendingSecret?.split('.')[1]);
  });
});
