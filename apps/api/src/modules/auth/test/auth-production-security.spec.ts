import { describe, expect, it } from 'vitest';

import { envSchema } from '#src/common/config/env.schema';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@postgres.example.test:5432/gym',
  JWT_SECRET: 'abcdefghijklmnopABCDEFGHIJKLMNOP0123456789',
  JWT_ISSUER: 'https://api.example.test',
  APP_URL: 'https://app.example.test',
  CORS_ORIGINS: 'https://app.example.test',
  SMTP_URL: 'smtps://smtp.example.test:465',
  MAIL_FROM: 'Gym Support <support@example.test>',
};

describe('production authentication and transport security boundaries', () => {
  it('accepts only an explicitly secure production configuration', () => {
    expect(envSchema.safeParse(production).success).toBe(true);
  });

  it.each([
    ['weak JWT secret', { JWT_SECRET: 'guessable' }],
    ['repetitive JWT secret', { JWT_SECRET: 'a'.repeat(64) }],
    ['insecure app origin', { APP_URL: 'http://app.example.test' }],
    ['insecure JWT issuer', { JWT_ISSUER: 'http://api.example.test' }],
    ['JWT issuer with embedded credentials', { JWT_ISSUER: 'https://user:pass@api.example.test' }],
    ['insecure browser origin', { CORS_ORIGINS: 'http://app.example.test' }],
    [
      'mixed-security browser origins',
      { CORS_ORIGINS: 'https://app.example.test,http://other.example.test' },
    ],
    ['unprotected SMTP', { SMTP_URL: 'smtp://smtp.example.test:25' }],
    ['missing outbound mail', { SMTP_URL: '', MAIL_FROM: '' }],
    [
      'mail header injection',
      { MAIL_FROM: 'Gym Support <support@example.test>\r\nBcc: test@example.test' },
    ],
    ['unexpected request origin', { CORS_ORIGINS: 'https://app.example.test/path' }],
  ])('rejects %s', (_name, override) => {
    expect(envSchema.safeParse({ ...production, ...override }).success).toBe(false);
  });

  it('requires a syntactically valid metrics token when scrape is enabled', () => {
    expect(envSchema.safeParse({ ...production, HTTP_METRICS_ENABLED: 'true' }).success).toBe(
      false,
    );
    expect(
      envSchema.safeParse({
        ...production,
        HTTP_METRICS_ENABLED: 'true',
        HTTP_METRICS_TOKEN: 'short',
      }).success,
    ).toBe(false);
    // Schema checks token shape, not randomness; operations must generate real entropy.
    expect(
      envSchema.safeParse({
        ...production,
        HTTP_METRICS_ENABLED: 'true',
        HTTP_METRICS_TOKEN: 'a'.repeat(43),
      }).success,
    ).toBe(true);
  });

  it('does not permit an invalid proxy address to impersonate the browser IP', () => {
    expect(envSchema.safeParse({ ...production, TRUSTED_PROXY_CIDRS: '0.0.0.0/0' }).success).toBe(
      false,
    );
  });
});
