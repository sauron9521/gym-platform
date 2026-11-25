import type { MfaOptions } from '@nestjs/authentication';

const MAX_KEYS = 5;

function invalidKeyring(): never {
  throw new Error('Expected distinct random 32-byte base64url MFA keys independent of the JWT key');
}

/** Newest key first; never permit plaintext migration. Does not activate MFA. */
export function createMfaEncryptionOptions(
  raw: string,
  jwtSecret: string,
): Exclude<MfaOptions['encryption'], false> {
  const values = raw.split(',').map((value) => value.trim());
  if (values.length > MAX_KEYS || new Set(values).size !== values.length) invalidKeyring();

  const keys = values.map((value) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) invalidKeyring();
    const key = Buffer.from(value, 'base64url');
    if (
      key.length !== 32 ||
      key.toString('base64url') !== value ||
      new Set(key).size < 8 ||
      value === jwtSecret ||
      key.equals(Buffer.from(jwtSecret, 'utf8')) ||
      (/^[A-Za-z0-9+/_-]+={0,2}$/.test(jwtSecret) &&
        key.equals(Buffer.from(jwtSecret, 'base64url')))
    ) {
      invalidKeyring();
    }
    return key;
  });

  return { keys, migratePlaintext: false };
}
